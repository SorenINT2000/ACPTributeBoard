import { createContext } from 'react';
import { type User } from 'firebase/auth';
import { type UserProfile } from '../utils/userProfile';

export interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    /** True if user has highLevel custom claim (can create artifacts, attach posts to exhibits) */
    isHighLevel: boolean;
}

export const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    userProfile: null,
    loading: true,
    isHighLevel: false,
});

