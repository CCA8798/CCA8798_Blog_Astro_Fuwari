export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

export function formatDate(date: Date, locale: string = 'zh-CN'): string {
  // 使用toLocaleString确保正确处理时区
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai' // 明确指定时区
  });
}

export function formatDateOnly(date: Date, locale: string = 'zh-CN'): string {
  // 只显示日期部分，但确保时区正确
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  });
}