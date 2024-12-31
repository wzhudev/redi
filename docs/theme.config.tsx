export default {
  docsRepositoryBase: 'https://github.com/wzhudev/redi/tree/main/docs',
  project: {
    link: 'https://github.com/wzhudev/redi',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Redi',
    }
  },
  logo: (
    <>
      <span style={{ marginLeft: '.4em', fontWeight: 800 }}>Redi</span>
    </>
  ),
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Redi" />
      <meta property="og:description" content="A light-weight dependency injection library" />
    </>
  ),
  i18n: [
    { locale: 'en-US', name: 'English' },
    { locale: 'zh-CN', name: '简体中文' },
  ],
  toc: {
    title: '',
    backToTop: true,
  },
  footer: {
    content: (
      <span>
        MIT
        {' '}
        {new Date().getFullYear()}
        {' '}
        ©
        {' '}
        <a href="https://wzhu.dev" target="_blank">
          wzhudev
        </a>
        .
      </span>
    ),
  },
  faviconGlyph: '💉',
}
