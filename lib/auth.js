import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import dbConnect from './mongodb';
import User from '@/models/User';

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'chess-arena-dev-secret-change-in-production'
);

export const COOKIE_NAME = 'chess_arena_token';
const TOKEN_DURATION = '7d';

export async function createToken(userId) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_DURATION)
    .sign(AUTH_SECRET);
  return token;
}

export async function verifyToken(token) {
  try {
    const verified = await jwtVerify(token, AUTH_SECRET, {
      algorithms: ['HS256'],
    });
    return verified.payload;
  } catch (err) {
    return null;
  }
}

export async function setAuthCookie(response, userId) {
  const token = await createToken(userId);
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearAuthCookie(response) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) return null;

  try {
    await dbConnect();
    const user = await User.findById(payload.userId).select('-passwordHash');
    return user;
  } catch (err) {
    console.error('[Auth] Failed to fetch user:', err.message);
    return null;
  }
}

export async function requireAuth(redirectTo = '/login') {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(redirectTo, process.env.NEXT_PUBLIC_APP_URL));
  }
  return user;
}

export function validateUsername(username) {
  const errors = [];
  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
    return errors;
  }
  const u = username.trim();
  if (u.length < 3) errors.push('Username must be at least 3 characters');
  if (u.length > 20) errors.push('Username must be at most 20 characters');
  if (!/^[a-zA-Z0-9_]+$/.test(u)) errors.push('Username can only contain letters, numbers and underscores');
  return errors;
}

export function validateEmail(email) {
  const errors = [];
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return errors;
  }
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) errors.push('Please enter a valid email address');
  return errors;
}

export function validatePassword(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return errors;
  }
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (password.length > 128) errors.push('Password is too long');
  return errors;
}
