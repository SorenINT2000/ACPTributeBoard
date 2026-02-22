import { useContext } from 'react';
import { AuthContext } from '../contexts/authContextConfig';

export function useAuth() {
    return useContext(AuthContext);
}

