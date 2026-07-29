const IMAP_CLIENT_ID = {
  name: 'one-mail-next',
  version: '26',
  vendor: 'pcjiang1998',
  'support-url': 'https://github.com/pcjiang1998/one-mail-next'
}

export function formatImapIdCommand(): string {
  const values = Object.entries(IMAP_CLIENT_ID).flatMap(([key, value]) => [key, value])
  return `ID (${values.map(quoteImapString).join(' ')})`
}

function quoteImapString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
