export interface User {
    id: string;
    username: string;
    email: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export type UserCredentials = LoginCredentials;