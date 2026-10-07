import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#3a63e0',
    colorSuccess: '#1f9d55',
    colorWarning: '#c27c0e',
    colorError: '#d23b3b',
    borderRadius: 6,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Segmented: { itemSelectedBg: '#e6ecfd', itemSelectedColor: '#3a63e0' },
  },
};
