function validateBvn(val) {
  if (!val) return "BVN is required";
  if (!/^\d{11}$/.test(val.trim())) {
    return "BVN must be exactly 11 digits";
  }
  return null;
}
function validateNin(val) {
  if (!val) return "NIN is required";
  const trimmed = val.trim();
  if (!/^\d{11}$/.test(trimmed) && !/^\d{2}-\d{3}-\d{4}$/.test(trimmed)) {
    return "NIN must be 11 digits (e.g. 12345678901) or XX-XXX-XXXX format";
  }
  return null;
}
function validateTin(val) {
  if (!val) return "TIN is required";
  const trimmed = val.trim();
  if (!/^[a-zA-Z0-9]{8,15}$/.test(trimmed)) {
    return "TIN must be 8–15 alphanumeric characters";
  }
  return null;
}
function validateCac(val) {
  if (!val) return "CAC number is required";
  const trimmed = val.trim();
  if (!/^[a-zA-Z0-9]{7,20}$/.test(trimmed)) {
    return "CAC number must be 7–20 alphanumeric characters";
  }
  return null;
}
function validatePhone(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Phone number is required";
  if (!/^(\+234|0)[789]\d{9}$/.test(trimmed))
    return "Enter a valid Nigerian phone number";
  return null;
}
function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return "Enter a valid email address";
  return null;
}
export {
  validateEmail as a,
  validateBvn as b,
  validateNin as c,
  validateCac as d,
  validateTin as e,
  validatePhone as v
};
