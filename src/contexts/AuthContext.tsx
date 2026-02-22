import { useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { AuthContext, type AuthContextType } from './authContextConfig';
import { subscribeToUserProfile, type UserProfile } from '../utils/userProfile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHighLevel, setIsHighLevel] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setUserProfile(null);
                setIsHighLevel(false);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // Resolve highLevel from token claims when user is authenticated
    useEffect(() => {
        if (!currentUser) {
            setIsHighLevel(false);
            return;
        }
        currentUser.getIdTokenResult()
            .then((result) => setIsHighLevel(result.claims.highLevel === true))
            .catch(() => setIsHighLevel(false));
    }, [currentUser]);

    // Subscribe to user profile when user is authenticated
    useEffect(() => {
        if (!currentUser) {
            return;
        }

        const unsubscribeProfile = subscribeToUserProfile(currentUser.uid, (profile) => {
            setUserProfile(profile);
            setLoading(false);
        });

        return unsubscribeProfile;
    }, [currentUser]);

    const value: AuthContextType = {
        currentUser,
        userProfile,
        loading,
        isHighLevel,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
