export const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '/');
export const formatNumber = (n: number) => n.toLocaleString('zh-TW');
