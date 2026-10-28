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
    createStartMenuShortcut: true
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
