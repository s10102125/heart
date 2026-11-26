import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

let env;
const profile = (db, uid) => doc(db, 'users', uid);
const grant = (db, uid = 'family') => doc(db, 'visits/elder/grants', uid);
const entries = (db) => collection(db, 'visits/elder/entries');
const proxy = (db, uid = 'family') => doc(db, 'proxyCare', uid, 'profiles/test');
const record = (db, uid = 'family') => doc(proxy(db, uid), 'records/test');
const actor = (uid) => env.authenticatedContext(uid).firestore();
const proxyData = () => ({ name: 'Care recipient', relation: 'Parent', consent: true, createdAt: serverTimestamp() });
const recordData = (uid, name) => ({
  kind: '照護觀察', when: '2026-11-26T10:00', text: 'Test record',
  actorUid: uid, actorName: name, createdAt: serverTimestamp()
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-heart-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
after(async () => { await env?.cleanup(); });

test('registration, sharing, proxy care and guest access', async (t) => {
  const elder = actor('elder');
  const family = actor('family');
  const outsider = actor('outsider');
  const guest = env.unauthenticatedContext().firestore();

  await t.test('first registration and immutable role', async () => {
    await assertSucceeds(setDoc(profile(elder, 'elder'), { name: 'Elder', role: 'elder' }));
    await assertSucceeds(setDoc(profile(family, 'family'), { name: 'Family', role: 'family' }));
    await assertSucceeds(setDoc(profile(outsider, 'outsider'), { name: 'Outsider', role: 'family' }));
    await assertSucceeds(setDoc(profile(elder, 'elder'), { name: 'Updated Elder' }, { merge: true }));
    await assertFails(setDoc(profile(elder, 'elder'), { role: 'family' }, { merge: true }));
    await assertFails(deleteDoc(profile(elder, 'elder')));
    await assertFails(getDoc(profile(family, 'elder')));
  });

  await t.test('elder grant and per-record sharing are both required', async () => {
    await assertSucceeds(setDoc(doc(entries(elder), 'shared'), { shared: true }));
    await assertSucceeds(setDoc(doc(entries(elder), 'private'), { shared: false }));
    await assertFails(getDoc(doc(entries(family), 'shared')));
    await assertFails(setDoc(grant(family), { name: 'Family' }));
    await assertSucceeds(setDoc(grant(elder), { name: 'Family' }));
    await assertSucceeds(getDocs(query(entries(family), where('shared', '==', true))));
    await assertFails(getDocs(entries(family)));
    await assertFails(getDoc(doc(entries(family), 'private')));
    await assertFails(getDoc(doc(entries(outsider), 'shared')));
    await assertFails(setDoc(doc(entries(family), 'shared'), { shared: false }));
    const health = db => doc(db, 'health/elder/private/state');
    await assertSucceeds(setDoc(health(elder), { test: true }));
    await assertFails(getDoc(health(family)));
    await assertSucceeds(deleteDoc(grant(elder)));
    await assertFails(getDoc(doc(entries(family), 'shared')));
  });

  await t.test('proxy records stay within the owning family account', async () => {
    await assertFails(setDoc(proxy(elder, 'elder'), proxyData()));
    await assertFails(setDoc(record(family), recordData('family', 'Family')));
    await assertSucceeds(setDoc(proxy(family), proxyData()));
    await assertFails(setDoc(record(family), recordData('outsider', 'Family')));
    await assertFails(setDoc(record(family), recordData('family', 'Other name')));
    await assertSucceeds(setDoc(record(family), recordData('family', 'Family')));
    await assertSucceeds(getDoc(record(family)));
    await assertFails(getDoc(record(outsider)));
    await assertFails(deleteDoc(record(outsider)));
    await assertFails(getDoc(proxy(elder)));
  });

  await t.test('guests cannot read or write', async () => {
    await assertFails(getDoc(profile(guest, 'elder')));
    await assertFails(getDoc(doc(entries(guest), 'shared')));
    await assertFails(getDoc(record(guest)));
    await assertFails(setDoc(proxy(guest), proxyData()));
  });
});
