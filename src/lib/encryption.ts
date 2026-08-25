import Cryptr from "cryptr";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is not set. " +
    "Please set a stable, random 32+ character string in your .env file. " +
    "Changing this key will make previously encrypted credentials undecryptable."
  );
}

const cryptr = new Cryptr(ENCRYPTION_KEY);

export const encrypt = (text: string) => cryptr.encrypt(text);
export const decrypt = (text: string) => cryptr.decrypt(text);
