type VerificationSession = {
  verificationId: string;
  maskedPhone: string;
  code: string;
};

const DEMO_CODE = '1357';

export async function requestSmsCode(phone: string): Promise<VerificationSession> {
  await delay(600);
  return {
    verificationId: `sms_${Date.now()}`,
    maskedPhone: phone.replace(/(\+7 \(\d{3}\) \d{3})-\d{2}-\d{2}/, '$1-**-**'),
    code: DEMO_CODE,
  };
}

export async function verifySmsCode(verificationId: string, code: string) {
  await delay(400);
  return {
    ok: Boolean(verificationId) && code === DEMO_CODE,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
