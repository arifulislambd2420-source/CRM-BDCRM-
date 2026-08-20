import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

/**
 * Idempotent demo seed. Runs from index.ts on boot when users table is empty
 * (SEED_ON_EMPTY env var). Also invokable via `npx prisma db seed`.
 */
export async function seed(): Promise<void> {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const stores = [
    { id: 'store-1', name: 'ঢাকা কেন্দ্রীয় শাখা' },
    { id: 'store-2', name: 'চট্টগ্রাম শাখা' },
    { id: 'store-3', name: 'সিলেট শাখা' },
  ];
  const users: Array<{
    id: string; name: string; email: string; password: string;
    role: 'admin' | 'sub_admin' | 'store_manager';
    storeId: string | null; canEditOwnNotes: boolean;
  }> = [
    { id: 'user-1', name: 'মুফতি হাফেজ মুসা খান', email: 'admin@prokashoni.bd', password: 'admin123', role: 'admin', storeId: null, canEditOwnNotes: true },
    { id: 'user-2', name: 'আব্দুল্লাহ আল মামুন', email: 'subadmin@prokashoni.bd', password: 'sub123', role: 'sub_admin', storeId: null, canEditOwnNotes: true },
    { id: 'user-3', name: 'রফিকুল ইসলাম', email: 'dhaka@prokashoni.bd', password: 'store123', role: 'store_manager', storeId: 'store-1', canEditOwnNotes: true },
    { id: 'user-4', name: 'সাইফুল হক', email: 'ctg@prokashoni.bd', password: 'store123', role: 'store_manager', storeId: 'store-2', canEditOwnNotes: false },
  ];
  const pipelines = [
    { id: 'pl-general', name: 'General',
      stages: ['নতুন লিড','যোগাযোগ হয়েছে','আগ্রহী','অর্ডার কনফার্ম','ডেলিভারি সম্পন্ন'],
      stageIds: ['st-g-1','st-g-2','st-g-3','st-g-4','st-g-5'] },
    { id: 'pl-fb', name: 'Facebook Ad লিড',
      stages: ['অ্যাড ক্লিক','মেসেজ পাঠিয়েছে','বই সম্পর্কে জিজ্ঞাসা','অর্ডার কনফার্ম','ডেলিভারি সম্পন্ন'],
      stageIds: ['st-fb-1','st-fb-2','st-fb-3','st-fb-4','st-fb-5'] },
    { id: 'pl-wa', name: 'WhatsApp লিড',
      stages: ['WhatsApp-এ যোগাযোগ','তথ্য প্রদান','অর্ডার প্রক্রিয়াধীন','পেমেন্ট সম্পন্ন','ডেলিভারি সম্পন্ন'],
      stageIds: ['st-wa-1','st-wa-2','st-wa-3','st-wa-4','st-wa-5'] },
    { id: 'pl-student', name: 'নতুন স্টুডেন্ট',
      stages: ['ভর্তির আবেদন','যাচাই চলছে','ভর্তি নিশ্চিত','বই সরবরাহ'],
      stageIds: ['st-s-1','st-s-2','st-s-3','st-s-4'] },
  ];
  const sources = ['বই থেকে', 'WhatsApp', 'Facebook Ads', 'Google Ads', 'ওয়েবসাইট', 'রেফারেন্স', 'অন্যান্য'];
  const names = ['মোহাম্মদ রায়হান','ফাতিমা খাতুন','আয়েশা সিদ্দিকা','আব্দুর রহমান','উম্মে সালমা','হাসান মাহমুদ','জুবায়ের আহমেদ','তাসনিম আক্তার','সাইফুল ইসলাম','নুসরাত জাহান','ইমরান হোসেন','সাদিয়া ইসলাম','কামরুল হাসান','রুবেল মিয়া','শাহাদাত হোসেন','মারিয়া আক্তার','তারিকুল ইসলাম','মেহেদী হাসান','রোকেয়া বেগম','জাহিদুল ইসলাম','আরিফুর রহমান','শামীম আহমেদ','নাজমুল হক','সুমাইয়া তাবাসসুম','ওমর ফারুক'];
  const addresses = ['মিরপুর, ঢাকা','উত্তরা, ঢাকা','মোহাম্মদপুর, ঢাকা','বাড্ডা, ঢাকা','পাহাড়তলী, চট্টগ্রাম','হালিশহর, চট্টগ্রাম','বন্দর, চট্টগ্রাম','জিন্দাবাজার, সিলেট','আম্বরখানা, সিলেট','বংশাল, ঢাকা'];
  const noteBank = ['বই কেনার সময় নাম্বার নেওয়া হয়েছে।','দাম জানতে চেয়েছিলেন, পরে জানাবেন।','ঈদের পর অর্ডার করবেন বলেছেন।','হোম ডেলিভারি চেয়েছেন।','তাফসীর সিরিজ সম্পর্কে জানতে চেয়েছিলেন।','বিকাশে পেমেন্ট করবেন।','একাধিক কপি লাগবে, মাদ্রাসার জন্য।','নতুন কাস্টমার — ফলো-আপ দরকার।','WhatsApp-এ যোগাযোগ হয়েছে।','ফোন ধরেননি, পরে ট্রাই করতে হবে।','অর্ডার কনফার্ম, কুরিয়ার পাঠানো হবে।'];

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000);
  const hoursAgo = (n: number) => new Date(now - n * 3_600_000);
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

  await prisma.$transaction(async (tx) => {
    // Stores must exist before users can reference them.
    for (const s of stores) await tx.store.create({ data: s });

    for (const u of users) {
      await tx.user.create({
        data: {
          id: u.id, name: u.name, email: u.email,
          passwordHash: hash(u.password),
          role: u.role, storeId: u.storeId, canEditOwnNotes: u.canEditOwnNotes,
        },
      });
    }

    for (const p of pipelines) {
      await tx.pipeline.create({ data: { id: p.id, name: p.name } });
      for (let i = 0; i < p.stages.length; i++) {
        await tx.stage.create({
          data: { id: p.stageIds[i], pipelineId: p.id, name: p.stages[i], sortIndex: i },
        });
      }
    }

    for (let i = 0; i < names.length; i++) {
      const source = pick(sources, i * 3 + 1);
      const store = pick(stores, i);
      const pipeline = pick(pipelines, i);
      const stageId = pipeline.stageIds[(i * 2) % pipeline.stageIds.length];
      const creator = users.find((u) => u.storeId === store.id) ?? users[0];
      const custId = `cust-${i + 1}`;

      await tx.customer.create({
        data: {
          id: custId,
          name: names[i],
          phone: `01${(700_000_000 + i * 12345).toString().slice(0, 9)}`,
          address: pick(addresses, i),
          source,
          pipelineId: pipeline.id,
          currentStageId: stageId,
          storeId: store.id,
          createdAt: daysAgo(i * 2 + 1),
          createdById: creator.id,
        },
      });

      const noteCount = (i % 4) + 1;
      for (let k = 0; k < noteCount; k++) {
        const author = pick(users, i + k);
        await tx.note.create({
          data: {
            id: `note-${i + 1}-${k + 1}`,
            customerId: custId,
            number: k + 1,
            text: pick(noteBank, i * 2 + k),
            createdAt: hoursAgo(i * 48 + (noteCount - k) * 12),
            createdById: author.id,
            createdByName: author.name,
          },
        });
      }
    }

    await tx.setting.create({ data: { key: 'sources', value: JSON.stringify(sources) } });
  });
}
