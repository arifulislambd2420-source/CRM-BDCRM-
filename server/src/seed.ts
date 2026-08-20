import bcrypt from 'bcryptjs';
import { db } from './db.js';

/**
 * Seed the database with the same demo dataset the frontend used to bundle.
 * Idempotent — only runs when the users table is empty.
 * Passwords are stored as bcrypt hashes (10 rounds is fine for local demo).
 */
export function seed(): void {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const insertStore = db.prepare(`INSERT INTO stores (id, name) VALUES (?, ?)`);
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, store_id, can_edit_own_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPipeline = db.prepare(`INSERT INTO pipelines (id, name) VALUES (?, ?)`);
  const insertStage = db.prepare(`
    INSERT INTO stages (id, pipeline_id, name, sort_index) VALUES (?, ?, ?, ?)
  `);
  const insertCustomer = db.prepare(`
    INSERT INTO customers
      (id, name, phone, address, source, pipeline_id, current_stage_id, store_id, created_at, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNote = db.prepare(`
    INSERT INTO notes (id, customer_id, number, text, created_at, created_by_id, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);

  const stores: Array<{ id: string; name: string }> = [
    { id: 'store-1', name: 'ঢাকা কেন্দ্রীয় শাখা' },
    { id: 'store-2', name: 'চট্টগ্রাম শাখা' },
    { id: 'store-3', name: 'সিলেট শাখা' },
  ];

  const users: Array<{
    id: string; name: string; email: string; password: string;
    role: 'admin' | 'sub_admin' | 'store_manager';
    storeId: string | null; canEditOwnNotes: number;
  }> = [
    { id: 'user-1', name: 'মুফতি হাফেজ মুসা খান', email: 'admin@prokashoni.bd', password: 'admin123', role: 'admin', storeId: null, canEditOwnNotes: 1 },
    { id: 'user-2', name: 'আব্দুল্লাহ আল মামুন', email: 'subadmin@prokashoni.bd', password: 'sub123', role: 'sub_admin', storeId: null, canEditOwnNotes: 1 },
    { id: 'user-3', name: 'রফিকুল ইসলাম', email: 'dhaka@prokashoni.bd', password: 'store123', role: 'store_manager', storeId: 'store-1', canEditOwnNotes: 1 },
    { id: 'user-4', name: 'সাইফুল হক', email: 'ctg@prokashoni.bd', password: 'store123', role: 'store_manager', storeId: 'store-2', canEditOwnNotes: 0 },
  ];

  const pipelines = [
    { id: 'pl-general', name: 'General', stages: [
      'নতুন লিড', 'যোগাযোগ হয়েছে', 'আগ্রহী', 'অর্ডার কনফার্ম', 'ডেলিভারি সম্পন্ন',
    ], stageIds: ['st-g-1', 'st-g-2', 'st-g-3', 'st-g-4', 'st-g-5'] },
    { id: 'pl-fb', name: 'Facebook Ad লিড', stages: [
      'অ্যাড ক্লিক', 'মেসেজ পাঠিয়েছে', 'বই সম্পর্কে জিজ্ঞাসা', 'অর্ডার কনফার্ম', 'ডেলিভারি সম্পন্ন',
    ], stageIds: ['st-fb-1', 'st-fb-2', 'st-fb-3', 'st-fb-4', 'st-fb-5'] },
    { id: 'pl-wa', name: 'WhatsApp লিড', stages: [
      'WhatsApp-এ যোগাযোগ', 'তথ্য প্রদান', 'অর্ডার প্রক্রিয়াধীন', 'পেমেন্ট সম্পন্ন', 'ডেলিভারি সম্পন্ন',
    ], stageIds: ['st-wa-1', 'st-wa-2', 'st-wa-3', 'st-wa-4', 'st-wa-5'] },
    { id: 'pl-student', name: 'নতুন স্টুডেন্ট', stages: [
      'ভর্তির আবেদন', 'যাচাই চলছে', 'ভর্তি নিশ্চিত', 'বই সরবরাহ',
    ], stageIds: ['st-s-1', 'st-s-2', 'st-s-3', 'st-s-4'] },
  ];

  const sources = ['বই থেকে', 'WhatsApp', 'Facebook Ads', 'Google Ads', 'ওয়েবসাইট', 'রেফারেন্স', 'অন্যান্য'];
  const names = ['মোহাম্মদ রায়হান','ফাতিমা খাতুন','আয়েশা সিদ্দিকা','আব্দুর রহমান','উম্মে সালমা','হাসান মাহমুদ','জুবায়ের আহমেদ','তাসনিম আক্তার','সাইফুল ইসলাম','নুসরাত জাহান','ইমরান হোসেন','সাদিয়া ইসলাম','কামরুল হাসান','রুবেল মিয়া','শাহাদাত হোসেন','মারিয়া আক্তার','তারিকুল ইসলাম','মেহেদী হাসান','রোকেয়া বেগম','জাহিদুল ইসলাম','আরিফুর রহমান','শামীম আহমেদ','নাজমুল হক','সুমাইয়া তাবাসসুম','ওমর ফারুক'];
  const addresses = ['মিরপুর, ঢাকা','উত্তরা, ঢাকা','মোহাম্মদপুর, ঢাকা','বাড্ডা, ঢাকা','পাহাড়তলী, চট্টগ্রাম','হালিশহর, চট্টগ্রাম','বন্দর, চট্টগ্রাম','জিন্দাবাজার, সিলেট','আম্বরখানা, সিলেট','বংশাল, ঢাকা'];
  const noteBank = ['বই কেনার সময় নাম্বার নেওয়া হয়েছে।','দাম জানতে চেয়েছিলেন, পরে জানাবেন।','ঈদের পর অর্ডার করবেন বলেছেন।','হোম ডেলিভারি চেয়েছেন।','তাফসীর সিরিজ সম্পর্কে জানতে চেয়েছিলেন।','বিকাশে পেমেন্ট করবেন।','একাধিক কপি লাগবে, মাদ্রাসার জন্য।','নতুন কাস্টমার — ফলো-আপ দরকার।','WhatsApp-এ যোগাযোগ হয়েছে।','ফোন ধরেননি, পরে ট্রাই করতে হবে।','অর্ডার কনফার্ম, কুরিয়ার পাঠানো হবে।'];

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const hoursAgo = (n: number) => new Date(now - n * 3_600_000).toISOString();
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

  const trx = db.transaction(() => {
    for (const s of stores) insertStore.run(s.id, s.name);
    for (const u of users) {
      insertUser.run(u.id, u.name, u.email, hash(u.password), u.role, u.storeId, u.canEditOwnNotes);
    }
    for (const p of pipelines) {
      insertPipeline.run(p.id, p.name);
      p.stages.forEach((name, i) => insertStage.run(p.stageIds[i], p.id, name, i));
    }

    for (let i = 0; i < names.length; i++) {
      const source = pick(sources, i * 3 + 1);
      const store = pick(stores, i);
      const pipeline = pick(pipelines, i);
      const stageId = pipeline.stageIds[(i * 2) % pipeline.stageIds.length];
      const creator = users.find((u) => u.storeId === store.id) ?? users[0];
      const createdAt = daysAgo(i * 2 + 1);
      const custId = `cust-${i + 1}`;

      insertCustomer.run(
        custId, names[i], `01${(700_000_000 + i * 12345).toString().slice(0, 9)}`,
        pick(addresses, i), source, pipeline.id, stageId, store.id, createdAt, creator.id,
      );

      const noteCount = (i % 4) + 1;
      for (let k = 0; k < noteCount; k++) {
        const author = pick(users, i + k);
        insertNote.run(
          `note-${i + 1}-${k + 1}`, custId, k + 1, pick(noteBank, i * 2 + k),
          hoursAgo(i * 48 + (noteCount - k) * 12), author.id, author.name,
        );
      }
    }

    insertSetting.run('sources', JSON.stringify(sources));
  });

  trx();
}
