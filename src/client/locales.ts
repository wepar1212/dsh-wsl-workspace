/** Copy dictionaries for the WSL workspace browser. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  trigger: 'WSL 工作区',
  'trigger.aria': '打开 WSL 工作区选择器',
  title: '选择 WSL 工作区',
  description: '连接本机 WSL 发行版，并将其中的文件夹添加为 DSH 工作区。',
  close: '关闭',
  enable: '启用 WSL 工作区',
  'enable.help': '仅在你手动开启后读取 WSL 发行版和目录。',
  loading: '正在读取 WSL…',
  unavailable: '当前无法使用 WSL。',
  retry: '重试',
  distribution: '发行版',
  path: 'Linux 路径',
  go: '转到',
  up: '上一级',
  refresh: '刷新',
  empty: '此目录没有子文件夹。',
  truncated: '仅显示前 1000 个文件夹，请输入更具体的路径。',
  cancel: '取消',
  add: '添加并打开工作区',
  adding: '正在添加…',
  'error.list': '无法读取 WSL 目录。',
  'error.add': '无法添加这个工作区。',
} satisfies Record<string, string>

/** WSL workspace locale key union. */
export type WslWorkspaceLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  trigger: 'WSL workspace',
  'trigger.aria': 'Open the WSL workspace picker',
  title: 'Choose a WSL workspace',
  description: 'Connect to a local WSL distribution and add one of its folders as a DSH workspace.',
  close: 'Close',
  enable: 'Enable WSL workspaces',
  'enable.help': 'DSH reads WSL distributions and folders only after you enable this switch.',
  loading: 'Reading WSL…',
  unavailable: 'WSL is currently unavailable.',
  retry: 'Retry',
  distribution: 'Distribution',
  path: 'Linux path',
  go: 'Go',
  up: 'Parent',
  refresh: 'Refresh',
  empty: 'This directory has no child folders.',
  truncated: 'Only the first 1000 folders are shown. Enter a more specific path.',
  cancel: 'Cancel',
  add: 'Add and open workspace',
  adding: 'Adding…',
  'error.list': 'Unable to read the WSL directory.',
  'error.add': 'Unable to add this workspace.',
} satisfies Record<WslWorkspaceLocaleKey, string>
