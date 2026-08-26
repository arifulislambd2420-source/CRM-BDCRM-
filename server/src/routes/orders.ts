import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, makeId, p } from '../utils.js';

const router = Router();
router.use(requireAuth);

// ── helpers ──────────────────────────────────────────────────────────────────

function toApi(order: OrderWithRelations) {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    status: order.status,
    totalOriginalAmount: Number(order.totalOriginalAmount),
    totalDiscountedAmount: Number(order.totalDiscountedAmount),
    totalPaid: Number(order.totalPaid),
    totalDue: Number(order.totalDue),
    notes: order.notes ?? '',
    createdById: order.createdById,
    createdByName: order.createdBy.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      quantity: i.quantity,
      unitOriginalPrice: Number(i.unitOriginalPrice),
      unitDiscountedPrice: Number(i.unitDiscountedPrice),
      lineTotal: Number(i.lineTotal),
    })),
    payments: order.payments.map((pay) => ({
      id: pay.id,
      amount: Number(pay.amount),
      paymentDate: pay.paymentDate.toISOString(),
      paymentMethod: pay.paymentMethod,
      note: pay.note ?? '',
      recordedById: pay.recordedById,
      createdAt: pay.createdAt.toISOString(),
    })),
  };
}

const INCLUDE = {
  customer: { select: { name: true, phone: true } },
  createdBy: { select: { name: true } },
  items: {
    include: { product: { select: { name: true } } },
    orderBy: { id: 'asc' as const },
  },
  payments: { orderBy: { paymentDate: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof INCLUDE }>;

/** Scope: store managers see only their store's customers' orders. */
async function buildWhere(userId: string, role: string): Promise<Prisma.OrderWhereInput> {
  if (role === 'store_manager') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
    if (!user?.storeId) return { id: 'never' }; // no store = no orders
    return { customer: { storeId: user.storeId } };
  }
  return {};
}

// ── routes ───────────────────────────────────────────────────────────────────

/** GET /api/orders?customerId=&status=&page=&limit= */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const where: Prisma.OrderWhereInput = {
      ...(await buildWhere(user.id, user.role)),
      ...(req.query.customerId ? { customerId: String(req.query.customerId) } : {}),
      ...(req.query.status ? { status: String(req.query.status) as any } : {}),
    };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ total, orders: orders.map(toApi) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const where = await buildWhere(user.id, user.role);
    const order = await prisma.order.findFirst({
      where: { id: p(req.params.id), ...where },
      include: INCLUDE,
    });
    if (!order) throw new HttpError(404, 'অর্ডার পাওয়া যায়নি।');
    res.json(toApi(order));
  }),
);

/**
 * POST /api/orders
 * Body: { customerId, items: [{productId, quantity, unitDiscountedPrice}], notes? }
 * Status starts as 'pending'. Stock is NOT deducted until confirmed.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const { customerId, items, notes } = req.body as {
      customerId: string;
      items: { productId: string; quantity: number; unitDiscountedPrice: number }[];
      notes?: string;
    };

    if (!customerId) throw new HttpError(400, 'কাস্টমার নির্বাচন করুন।');
    if (!items?.length) throw new HttpError(400, 'কমপক্ষে একটি পণ্য যোগ করুন।');

    // Verify customer access
    if (user.role === 'store_manager') {
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { storeId: true } });
      const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { storeId: true } });
      if (!cust || cust.storeId !== u?.storeId) throw new HttpError(403, 'এই কাস্টমারের অর্ডার তৈরি করার অনুমতি নেই।');
    }

    // Load products for price snapshots
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalOriginal = 0;
    let totalDiscounted = 0;
    const itemData: Prisma.OrderItemCreateManyOrderInput[] = [];

    for (const item of items) {
      const prod = productMap.get(item.productId);
      if (!prod) throw new HttpError(400, `পণ্য পাওয়া যায়নি: ${item.productId}`);
      if (item.quantity < 1) throw new HttpError(400, 'পরিমাণ কমপক্ষে ১ হতে হবে।');
      const unitOrig = Number(prod.price);
      const unitDisc = Number(item.unitDiscountedPrice);
      const lineTotal = unitDisc * item.quantity;
      totalOriginal += unitOrig * item.quantity;
      totalDiscounted += lineTotal;
      itemData.push({
        id: makeId('oi'),
        productId: item.productId,
        quantity: item.quantity,
        unitOriginalPrice: unitOrig.toFixed(2),
        unitDiscountedPrice: unitDisc.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    }

    const order = await prisma.order.create({
      data: {
        id: makeId('ord'),
        customerId,
        status: 'pending',
        totalOriginalAmount: totalOriginal.toFixed(2),
        totalDiscountedAmount: totalDiscounted.toFixed(2),
        totalPaid: '0.00',
        totalDue: totalDiscounted.toFixed(2),
        notes: notes ?? null,
        createdById: user.id,
        items: { createMany: { data: itemData } },
      },
      include: INCLUDE,
    });

    res.status(201).json(toApi(order));
  }),
);

/**
 * POST /api/orders/:id/confirm
 * Deducts stock. If any product is short, we warn but still allow (backorder).
 * Creates StockMovement rows for audit.
 */
router.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const orderId = p(req.params.id);
    const scopeWhere = await buildWhere(user.id, user.role);

    const order = await prisma.order.findFirst({
      where: { id: orderId, ...scopeWhere },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new HttpError(404, 'অর্ডার পাওয়া যায়নি।');
    if (order.status !== 'pending') throw new HttpError(400, 'শুধু pending অর্ডার কনফার্ম করা যাবে।');

    const warnings: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const currentStock = item.product.stockQuantity;
        if (currentStock < item.quantity) {
          warnings.push(
            `"${item.product.name}": স্টকে আছে ${currentStock}, অর্ডার ${item.quantity} (ব্যাকঅর্ডারে গেছে)`,
          );
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            id: makeId('sm'),
            productId: item.productId,
            orderId,
            change: -item.quantity,
            reason: `অর্ডার কনফার্ম: ${orderId}`,
          },
        });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'confirmed' } });
    });

    const updated = await prisma.order.findUnique({ where: { id: orderId }, include: INCLUDE });
    res.json({ order: toApi(updated!), warnings });
  }),
);

/** POST /api/orders/:id/cancel */
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const orderId = p(req.params.id);
    const scopeWhere = await buildWhere(user.id, user.role);
    const order = await prisma.order.findFirst({ where: { id: orderId, ...scopeWhere } });
    if (!order) throw new HttpError(404, 'অর্ডার পাওয়া যায়নি।');
    if (order.status === 'cancelled') throw new HttpError(400, 'অর্ডারটি ইতিমধ্যে বাতিল।');

    // If confirmed, restore stock
    if (order.status === 'confirmed') {
      const items = await prisma.orderItem.findMany({ where: { orderId } });
      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              id: makeId('sm'),
              productId: item.productId,
              orderId,
              change: item.quantity,
              reason: `অর্ডার বাতিল (স্টক পুনরুদ্ধার): ${orderId}`,
            },
          });
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
      });
    } else {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
    }

    const updated = await prisma.order.findUnique({ where: { id: orderId }, include: INCLUDE });
    res.json(toApi(updated!));
  }),
);

/** POST /api/orders/:id/payments — record a partial payment (Stage 3 UI, route here) */
router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const { user } = req as any;
    const orderId = p(req.params.id);
    const scopeWhere = await buildWhere(user.id, user.role);
    const order = await prisma.order.findFirst({ where: { id: orderId, ...scopeWhere } });
    if (!order) throw new HttpError(404, 'অর্ডার পাওয়া যায়নি।');
    if (order.status === 'cancelled') throw new HttpError(400, 'বাতিল অর্ডারে পেমেন্ট যোগ করা যাবে না।');

    const { amount, paymentMethod, paymentDate, note } = req.body;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) throw new HttpError(400, 'পরিমাণ দিন।');
    if (!paymentMethod) throw new HttpError(400, 'পেমেন্ট পদ্ধতি দিন।');

    const payment = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: {
          id: makeId('pay'),
          orderId,
          amount: amountNum.toFixed(2),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod,
          note: note ?? null,
          recordedById: user.id,
        },
      });
      // Recalculate totalPaid + totalDue
      const allPayments = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amount: true },
      });
      const totalPaid = Number(allPayments._sum.amount ?? 0);
      const totalDue = Number(order.totalDiscountedAmount) - totalPaid;
      await tx.order.update({
        where: { id: orderId },
        data: { totalPaid: totalPaid.toFixed(2), totalDue: totalDue.toFixed(2) },
      });
      return pay;
    });

    const updated = await prisma.order.findUnique({ where: { id: orderId }, include: INCLUDE });
    res.status(201).json({ payment, order: toApi(updated!) });
  }),
);

export default router;
