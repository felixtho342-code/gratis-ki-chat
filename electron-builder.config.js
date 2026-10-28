const repository = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repository ? repository.split("/") : [];

module.exports = {
  appId: "de.gratis-ki.chat",
  productName: "Gratis KI Chat",
  directories: {
    output: "dist"
  },
  files: [
    "src/**/*",
    "package.json",
    "!**/*.map"
  ],
  win: {
    icon: "assets/app-icon.ico",
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerIcon: "assets/app-icon.ico",
    uninstallerIcon: "assets/app-icon.ico"
  },
  ...(owner && repo
    ? {
        publish: [
          {
            provider: "github",
            owner,
            repo,
            releaseType: "release"
          }
        ]
      }
    : {})
};
