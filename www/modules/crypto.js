// modular inverse using Extended Euclidean Algorithm
function modInv(a, p) {
  let [lm, hm] = [1n, 0n];
  let [low, high] = [BigInt(a % p), BigInt(p)];
  while (low > 1n) {
    let r = high / low;
    [lm, hm] = [hm - lm * r, lm];
    [low, high] = [high - low * r, low];
  }
  return (lm + BigInt(p)) % BigInt(p);
}

// Ed25519 signature verification
export async function verifyEd25519Signature(publicKey, message, signature) {
  const pubKeyBytes =
    publicKey instanceof Uint8Array ? publicKey : Uint8Array.from(publicKey);
  const sigBytes =
    signature instanceof Uint8Array ? signature : Uint8Array.from(signature);
  const msgBytes =
    message instanceof Uint8Array ? message : new TextEncoder().encode(message);

  const subtle = window.crypto.subtle;

  const cryptoKey = await subtle.importKey(
    "raw",
    pubKeyBytes,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return await subtle.verify(
    { name: "Ed25519" },
    cryptoKey,
    sigBytes,
    msgBytes,
  );
}

// reconstruct the secret using Lagrange interpolation
export async function reconstructSecret(shares, prime, publicKey) {
  const p = BigInt(prime);

  for (const share of shares) {
    const x = BigInt(share.x);
    const y = BigInt(share.y);
    if (!(0n < x) || !(0n <= y)) {
      throw new Error(`Share x=${x} or y=${y} out of valid range`);
    }
  }

  let secret = 0n;
  const n = shares.length;
  for (let i = 0; i < n; i++) {
    const xi = BigInt(shares[i].x);
    const yi = BigInt(shares[i].y);
    let li = 1n;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const xj = BigInt(shares[j].x);
        const numerator = (-xj + p) % p;
        const denominator = (xi - xj + p) % p;
        li = (li * numerator * modInv(denominator, p)) % p;
      }
    }
    secret = (secret + yi * li) % p;
  }
  return secret;
}
