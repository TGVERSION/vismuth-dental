import { NextResponse } from 'next/server';

// Общий ответ для закрытого публичного пути к внутреннему ML-классификатору.
const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
export const HEAD = notFound;
