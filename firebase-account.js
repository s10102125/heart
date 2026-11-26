import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const app=initializeApp({apiKey:"AIzaSyDY_wHpj37Hj3H_7U5j_s7YNmP_kSmSrw0",authDomain:"heart-99309.firebaseapp.com",projectId:"heart-99309",storageBucket:"heart-99309.firebasestorage.app",messagingSenderId:"129078936912",appId:"1:129078936912:web:bbf0a7629bb6f0b91dd855"});
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
let unsubscribe=()=>{},generation=0;
const msg=t=>$('authStatus').textContent=t;
const error=e=>{const messages={'auth/invalid-credential':'電子郵件或密碼錯誤','auth/email-already-in-use':'此電子郵件已註冊','auth/weak-password':'密碼至少需要六個字元','auth/popup-closed-by-user':'已關閉登入視窗','permission-denied':'資料庫權限不足，請確認安全規則'};msg(messages[e.code]||'操作未完成：'+(e.code||'請稍後再試'))};
const run=fn=>async e=>{e?.preventDefault();try{await fn()}catch(e){error(e)}};
$('authForm').onsubmit=run(()=>signInWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value));
$('authRegister').onclick=run(async()=>{if(!$('authForm').reportValidity())return;await createUserWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value)});
$('authGoogle').onclick=run(()=>signInWithPopup(auth,new GoogleAuthProvider()));
$('authReset').onclick=run(async()=>{if(!$('authEmail').reportValidity())return;await sendPasswordResetEmail(auth,$('authEmail').value.trim());msg('若帳號符合條件，請查看密碼重設郵件。')});
$('authLogout').onclick=run(()=>signOut(auth));
$('profileForm').onsubmit=run(async()=>{const user=auth.currentUser;if(!user)return;const name=$('profileName').value.trim();if(!name)return;await setDoc(doc(db,'users',user.uid),{name,role:$('profileRole').value});await load(user)});
async function load(user){const g=++generation;unsubscribe();window.healthSession(null,null);$('health').hidden=true;$('familyPanel').hidden=true;$('authProfile').hidden=true;$('authGuest').hidden=!!user;$('authMember').hidden=!user;$('authPassword').value='';$('profileName').value='';$('memberName').textContent='';if(!user){msg('請登入或註冊帳號');return}msg('正在讀取帳號…');const snap=await getDoc(doc(db,'users',user.uid));if(g!==generation)return;if(!snap.exists()){ $('authProfile').hidden=false;msg('首次登入，請設定您的身分');return}const p=snap.data();$('memberName').textContent=p.name+' ｜ '+(p.role==='elder'?'長者':'家人');msg('已登入');$('familyPanel').hidden=false;if(p.role!=='elder')return;const ref=doc(db,'health',user.uid,'private','state');window.healthSession(user.uid,async data=>{if(auth.currentUser?.uid!==user.uid)return;try{await setDoc(ref,data)}catch(e){error(e)}});unsubscribe=onSnapshot(ref,s=>{if(g!==generation)return;window.healthReceive(user.uid,s.exists()?s.data():{});$('health').hidden=false},e=>{if(g===generation){$('health').hidden=true;error(e)}})}
onAuthStateChanged(auth,user=>load(user).catch(error));
