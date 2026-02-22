import { doc, getDoc, setDoc, updateDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';

/**
 * User profile data stored in Firestore
 */
export interface UserProfile {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: number;
    updatedAt: number;
    role: string;
}

/**
 * Get a user's display name from their profile
 */
export function getDisplayName(profile: UserProfile | null): string {
    if (!profile) return 'Anonymous';
    if (profile.firstName && profile.lastName) {
        return `${profile.firstName} ${profile.lastName}`;
    }
    if (profile.firstName) return profile.firstName;
    if (profile.lastName) return profile.lastName;
    return profile.email || 'Anonymous';
}

/**
 * Get a user's profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(firestore, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    }
    return null;
}

/**
 * Create a new user profile in Firestore
 */
export async function createUserProfile(
    uid: string,
    email: string,
    firstName: string,
    lastName: string
): Promise<UserProfile> {
    const profile: UserProfile = {
        uid,
        email,
        firstName,
        lastName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role: 'user',
    };
    
    const docRef = doc(firestore, 'users', uid);
    await setDoc(docRef, profile);
    
    return profile;
}

/**
 * Update a user's profile in Firestore
 */
export async function updateUserProfile(
    uid: string,
    updates: Partial<Pick<UserProfile, 'firstName' | 'lastName'>>
): Promise<void> {
    const docRef = doc(firestore, 'users', uid);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: Date.now(),
    });
}

/**
 * Subscribe to a user's profile for real-time updates
 */
export function subscribeToUserProfile(
    uid: string,
    callback: (profile: UserProfile | null) => void
): Unsubscribe {
    const docRef = doc(firestore, 'users', uid);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as UserProfile);
        } else {
            callback(null);
        }
    });
}

/**
 * Get multiple user profiles by their UIDs
 * Returns a map of uid -> UserProfile
 */
export async function getUserProfiles(uids: string[]): Promise<Map<string, UserProfile>> {
    const profiles = new Map<string, UserProfile>();
    
    // Fetch profiles in parallel
    const promises = uids.map(async (uid) => {
        const profile = await getUserProfile(uid);
        if (profile) {
            profiles.set(uid, profile);
        }
    });
    
    await Promise.all(promises);
    return profiles;
}
