import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const MAX_TOKENS = 10;
const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

export interface TokenStatus {
  remaining: number;
  nextReset: Date;
  canUseAI: boolean;
}

export class TokenService {
  /**
   * Fetches or initializes user tokens
   */
  public async getStatus(): Promise<TokenStatus> {
    const user = auth.currentUser;
    if (!user) {
      return { remaining: 0, nextReset: new Date(), canUseAI: false };
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Initialize new user
      const initialStatus = {
        uid: user.uid,
        email: user.email,
        tokens: MAX_TOKENS,
        lastReset: serverTimestamp()
      };
      await setDoc(userRef, initialStatus);
      return { 
        remaining: MAX_TOKENS, 
        nextReset: new Date(Date.now() + RESET_INTERVAL), 
        canUseAI: true 
      };
    }

    const data = userSnap.data();
    const lastReset = (data.lastReset as Timestamp).toDate();
    const now = new Date();

    // Check if reset is due
    if (now.getTime() - lastReset.getTime() > RESET_INTERVAL) {
      await updateDoc(userRef, {
        tokens: MAX_TOKENS,
        lastReset: serverTimestamp()
      });
      return { 
        remaining: MAX_TOKENS, 
        nextReset: new Date(now.getTime() + RESET_INTERVAL), 
        canUseAI: true 
      };
    }

    return {
      remaining: data.tokens,
      nextReset: new Date(lastReset.getTime() + RESET_INTERVAL),
      canUseAI: data.tokens > 0
    };
  }

  /**
   * Consumes one token
   */
  public async consumeToken(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    const status = await this.getStatus();
    if (!status.canUseAI) return false;

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      tokens: status.remaining - 1
    });

    return true;
  }
}

export const tokenService = new TokenService();
