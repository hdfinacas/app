export const formatPhoneBR = (value?: string | null) => {
  const original = String(value || "").trim();
  let digits = original.replace(/\D/g, "");

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }

  return original;
};

type ClientContact = {
  phone?: string | null;
  whatsapp?: string | null;
};

/** Número principal para contato e cobrança. WhatsApp tem prioridade. */
export const getPreferredPhone = (contact?: ClientContact | null) =>
  String(contact?.whatsapp || contact?.phone || "").trim() || null;

/**
 * Telefone e WhatsApp representam o mesmo número quando apenas um deles foi
 * informado. Se ambos foram preenchidos, preserva os dois valores distintos.
 */
export const resolveClientPhones = (phone?: string | null, whatsapp?: string | null) => {
  const normalizedPhone = String(phone || "").trim() || null;
  const normalizedWhatsapp = String(whatsapp || "").trim() || null;
  const shared = normalizedWhatsapp || normalizedPhone;

  return {
    phone: normalizedPhone || shared,
    whatsapp: normalizedWhatsapp || shared,
  };
};
