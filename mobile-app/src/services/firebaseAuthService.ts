/**
 * Firebase Authentication Service
 */

import {auth} from '../config/firebase';
import {httpClient} from './httpClient';
import {User, AuthResponse} from '../types';

export const firebaseAuthService = {
  /**
   * Sign in with phone number
   */
  async signInWithPhone(phoneNumber: string): Promise<string> {
    try {
      // Format phone number (add +84 for Vietnam)
      const formattedPhone = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+84${phoneNumber.replace(/^0/, '')}`;

      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      return confirmation.verificationId;
    } catch (error: any) {
      console.error('Firebase phone auth error:', error);
      throw new Error(error.message || 'Lỗi xác thực số điện thoại');
    }
  },

  /**
   * Verify phone code
   */
  async verifyPhoneCode(
    verificationId: string,
    code: string,
  ): Promise<string> {
    try {
      const {PhoneAuthProvider} = auth();
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await auth().signInWithCredential(credential);
      return userCredential.user.uid;
    } catch (error: any) {
      console.error('Firebase verify code error:', error);
      throw new Error(error.message || 'Mã xác thực không đúng');
    }
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<string> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password,
    );
      return userCredential.user.uid;
    } catch (error: any) {
      console.error('Firebase email auth error:', error);
      throw new Error(error.message || 'Đăng nhập thất bại');
    }
  },

  /**
   * Get Firebase ID token
   */
  async getIdToken(): Promise<string | null> {
    try {
      const user = auth().currentUser;
      if (user) {
        return await user.getIdToken();
      }
      return null;
    } catch (error) {
      console.error('Get ID token error:', error);
      return null;
    }
  },

  /**
   * Sign in with Firebase and get backend token
   */
  async signInAndGetBackendToken(
    phoneOrEmail: string,
    password?: string,
  ): Promise<AuthResponse> {
    try {
      let firebaseUid: string;

      // Determine if it's phone or email
      if (phoneOrEmail.includes('@')) {
        // Email login
        if (!password) {
          throw new Error('Vui lòng nhập mật khẩu');
        }
        firebaseUid = await this.signInWithEmail(phoneOrEmail, password);
      } else {
        // Phone login - requires OTP verification
        throw new Error(
          'Đăng nhập bằng số điện thoại cần xác thực OTP. Vui lòng sử dụng signInWithPhone.',
        );
      }

      // Get Firebase ID token
      const firebaseToken = await this.getIdToken();
      if (!firebaseToken) {
        throw new Error('Không thể lấy Firebase token');
      }

      // Send Firebase token to backend to get backend token
      const response = await httpClient.post<AuthResponse>('/auth/firebase', {
        firebaseToken,
        firebaseUid,
      });

      if (response.success && response.data.token) {
        httpClient.setToken(response.data.token);
      }

      return response.data;
    } catch (error: any) {
      console.error('Sign in with backend error:', error);
      throw error;
    }
  },

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Firebase sign out error:', error);
    }
  },

  /**
   * Get current Firebase user
   */
  getCurrentFirebaseUser() {
    return auth().currentUser;
  },

  /**
   * Sign in with custom token (for OTP login)
   */
  async signInWithCustomToken(customToken: string): Promise<string> {
    try {
      const userCredential = await auth().signInWithCustomToken(customToken);
      return userCredential.user.uid;
    } catch (error: any) {
      console.error('Firebase custom token auth error:', error);
      throw new Error(error.message || 'Đăng nhập với custom token thất bại');
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: any) => void) {
    return auth().onAuthStateChanged(callback);
  },
};

