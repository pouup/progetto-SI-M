import time
import base64
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
import qrcode
import json
from typing import List
import os

class Share:
    def __init__(
        self,
        x: int,
        y: int,
    ):
        self.x = x
        self.y = y

    def __repr__(self):
        return (
            f"Share(x={self.x}, y={self.y}, "
            f"messageId={self.message_id})"
        )

    def set_message_id(self, message_id: str):
        self.message_id = message_id

    def to_json(self) -> str:
        result = {
            "type": "share",
            "messageId" : self.message_id,
            "x": base64.b64encode(self.x.to_bytes((self.x.bit_length() + 7) // 8 or 1, "big")).decode(),
            "y": base64.b64encode(self.y.to_bytes((self.y.bit_length() + 7) // 8 or 1, "big")).decode(),
        }

        return json.dumps(result, separators=(',', ':'))

class EncryptedMessage:
    def __init__(
        self,
        id: str,
        ciphertext: bytes,
        nonce: bytes,
        sender_public_key: bytes,
        created_at: int,
        threshold: int
    ):
        self.id = id
        self.ciphertext = ciphertext
        self.nonce = nonce
        self.sender_public_key = sender_public_key
        self.created_at = created_at
        self.threshold = threshold

    def __repr__(self):
        return (
            f"EncryptedMessage(id={self.id}, "
            f"ciphertext={self.ciphertext.hex()[:16]}..., "
            f"nonce={self.nonce.hex()[:16]}..., "
            f"senderPublicKey={self.sender_public_key.hex()[:16]}..., "
            f"createdAt={self.created_at}, threshold={self.threshold})"
        )

    def to_json(self) -> str:
        result = {
            "type": "encryptedMessage",
            "id": self.id,
            "ciphertext": base64.b64encode(self.ciphertext).decode(),
            "nonce": base64.b64encode(self.nonce).decode(),
            "senderPublicKey": base64.b64encode(self.sender_public_key).decode(),
            "createdAt": self.created_at,
            "threshold": self.threshold
        }
        return json.dumps(result, separators=(',', ':'))
# 256-bit prime (NIST P-256 prime) used for modular arithmetic in Shamir's Secret Sharing
PRIME: int = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff

def eval_polynomial(x: int, coeffs: List[int], prime: int = PRIME) -> int:
    """
    Evaluate a polynomial at a given x using Horner's method, modulo prime.
    """
    y = 0
    tmp = 1
    for coeff in coeffs:
        y = (y + coeff * tmp) % prime
        tmp = (tmp * x) % prime
    return y

def split_secret(
    secret: int,
    shares_count: int,
    threshold: int
) -> List[Share]:
    """
    Split a secret into shares using Shamir's Secret Sharing.
    """

    if not (0 <= secret < PRIME):
        raise ValueError("Secret must be less than the prime.")

    # generate random coefficients for the polynomial (degree threshold-1).
    poly_coeffs: List[int] = [secret] + [secrets.randbelow(PRIME - 1) + 1 for _ in range(threshold - 1)]

    shares: List[Share] = []
    for x in range(1, shares_count + 1):  # x starts from 1
        y: int = eval_polynomial(x, poly_coeffs, PRIME)
        shares.append(Share(x, y))

    return shares

def generate_qr_code(data: str, filename: str):
    image = qrcode.make(data)
    image.save(filename)

if __name__ == "__main__":
    if not os.path.exists("output"):
        os.makedirs("output")
    os.chdir("output")

    shares = None
    threshold = None
    while shares is None or threshold is None:
        try:
            shares = int(input("Enter the number of shares to create: "))
            threshold = int(input("Enter the threshold for reconstruction: "))
            if shares < threshold:
                print("Number of shares must be greater than or equal to the threshold.")
                shares = None
                threshold = None
            elif shares <= 0 or threshold <= 0:
                print("Both shares and threshold must be positive integers.")
                shares = None
                threshold = None
        except ValueError:
            print("Invalid input. Please enter integers.")

    message = input("Enter the message to encrypt: ")

    secret = None
    while secret is None:
        secret = secrets.token_bytes(32)  # 256-bit secret for AES-GCM
        if int.from_bytes(secret,"big") >= PRIME:
            secret = None
    nonce = secrets.token_bytes(12)  # 96-bit nonce for AES-GCM
    ciphertext = AESGCM(secret).encrypt(nonce, message.encode(), None)

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )

    encrypted_message = EncryptedMessage(
        id=base64.urlsafe_b64encode(secrets.token_bytes(16)).decode().rstrip("="),
        ciphertext=ciphertext,
        nonce=nonce,
        sender_public_key=public_key,
        created_at=int(time.time()),
        threshold=threshold
    )

    print(f"Encrypted Message: {encrypted_message}")
    message_qr_text = base64.b64encode(encrypted_message.to_json().encode()).decode()
    generate_qr_code(message_qr_text, "encrypted_message_qr.png")

    shares = split_secret(
        secret=int.from_bytes(secret, "big"),
        shares_count=shares,
        threshold=threshold,
    )

    for i, share in enumerate(shares):
        share.set_message_id(encrypted_message.id)
        print(f"Share {i + 1}: {share}")

        payload = share.to_json().encode()
        signature = private_key.sign(payload)
        share_qr_text = f"{base64.b64encode(payload).decode()}.{base64.b64encode(signature).decode()}"

        generate_qr_code(share_qr_text, f"share_{i + 1}.png")
