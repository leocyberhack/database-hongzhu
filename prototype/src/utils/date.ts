import dayjs from 'dayjs'

export const formatDate = (value?: string | number | Date, pattern = 'YYYY-MM-DD') => (value ? dayjs(value).format(pattern) : '-')

export const dateRange = (start: string, end: string) => {
  const result: string[] = []
  let cursor = dayjs(start)
  const endDate = dayjs(end)
  while (cursor.isSame(endDate) || cursor.isBefore(endDate)) {
    result.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }
  return result
}

export const nextNDays = (days: number) => {
  const result: string[] = []
  let cursor = dayjs()
  for (let i = 0; i < days; i += 1) {
    result.push(cursor.add(i, 'day').format('YYYY-MM-DD'))
  }
  return result
}

export const friendlyRange = (start: string, end: string) => `${formatDate(start)} ~ ${formatDate(end)}`
