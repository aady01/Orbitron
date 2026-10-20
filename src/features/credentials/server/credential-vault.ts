import "server-only";

import { CredentialType } from "@/generated/prisma";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

interface ResolveCredentialInput {
  credentialId: string;
  ownerId: string;
  expectedType: CredentialType;
}

export type CredentialResolution =
  | { ok: true; secret: string }
  | {
      ok: false;
      reason: "not_found" | "type_mismatch" | "undecryptable";
      message: string;
    };

export const resolveCredentialSecret = async ({
  credentialId,
  ownerId,
  expectedType,
}: ResolveCredentialInput): Promise<CredentialResolution> => {
  const credential = await prisma.credential.findFirst({
    where: {
      id: credentialId,
      userId: ownerId,
    },
    select: {
      type: true,
      value: true,
    },
  });

  if (!credential) {
    return {
      ok: false,
      reason: "not_found",
      message: "Credential not found",
    };
  }

  if (credential.type !== expectedType) {
    return {
      ok: false,
      reason: "type_mismatch",
      message: `Credential must be of type ${expectedType}`,
    };
  }

  try {
    return {
      ok: true,
      secret: decrypt(credential.value),
    };
  } catch {
    return {
      ok: false,
      reason: "undecryptable",
      message: "Credential could not be decrypted; save the API key again",
    };
  }
};
