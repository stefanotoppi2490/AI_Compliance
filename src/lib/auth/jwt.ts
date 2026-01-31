import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export type JwtPayload = {
  sub: string; // userId
  email: string;
};

export async function signAuthJwt(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAuthJwt(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayload & { exp: number; iat: number };
}
