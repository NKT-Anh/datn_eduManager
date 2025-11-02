import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";

export async function loginWithEmail(email:string,password:string) {
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    const idToken = await userCredential.user.getIdToken();
    return idToken;
    
}

export async function sendResetPasswordEmail(email: string) {
    await sendPasswordResetEmail(auth, email);
}