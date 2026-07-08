import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const db = getFirestore("ai-studio-a807d10e-b26a-4c76-90b4-c26febef321c");

const userId = 'danish125';

async function queryUser() {
  try {
    console.log(`[Admin SDK] Fetching user: ${userId}...`);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} does not exist in db.`);
      return;
    }
    console.log('User Profile:', JSON.stringify(userDoc.data(), null, 2));

    const subs = ['deposits', 'withdrawals', 'investments', 'referrals', 'daily_rewards'];
    for (const sub of subs) {
      console.log(`\n--- Subcollection: ${sub} ---`);
      const snapshot = await db.collection('users').doc(userId).collection(sub).get();
      if (snapshot.empty) {
        console.log(`No docs in ${sub}`);
      } else {
        snapshot.forEach(doc => {
          console.log(`[${sub}] ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
        });
      }
    }
  } catch (err) {
    console.error("Admin SDK query failed:", err);
  }
}

queryUser();
