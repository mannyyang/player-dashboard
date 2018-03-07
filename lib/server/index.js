const webpack = require('webpack');
const authors = require('parse-authors');
const importFrom = require('import-from'); // used to get the users project details form their working dir
const reporter = require('./reporter-util.js'); // webpack stats formatters & helpers
const server = require('./server.js'); // client server

const pkg = importFrom(process.cwd(), "./package.json");

class PlayerDashboard {
  constructor(opts = {}) {
    opts.host = opts.host || "localhost";
    opts.port = parseInt(opts.port || 1337, 10);
    opts.keepAlive = !!opts.keepAlive;

    if (opts.port && isNaN(opts.port)) {
      console.error(`[PLAYER DASHBOARD] error: the specified port (${opts.port}) is invalid. Reverting to 1337`);
      opts.port = 1337;
    }

    this.options = opts;

    this.env = {
      production: false,
      running: false, // indicator if our express server + sockets are running
      watching: false
    };

    this.reports = {
      stats: {},
      progress: {},
      project: {}
    };
  }

  apply(compiler) {
    const { name, version, author: makers } = pkg;
    const normalizedAuthor = parseAuthor(makers);

    this.reports.project = { name, version, makers: normalizedAuthor };

    // check if the current build is production, via defined plugin
    const definePlugin = compiler.options.plugins.find(fn => fn.constructor.name === "DefinePlugin");

    if (definePlugin) {
      const pluginNodeEnv = definePlugin["definitions"]["process.env.NODE_ENV"];
      this.env.production = pluginNodeEnv === "production";
    }

    let player;
    let isDev = !this.env.production;
    let { port, host } = this.options;

    if (!this.env.running) {
      player = this.server = server.init(compiler, isDev);
      player.http.listen(port, host, _ => {
        console.log(`[PLAYER DASHBOARD] Starting dashboard on: http://${host}:${port}`);
        this.env.running = true;

        // if a new client is connected push current bundle info
        player.io.on('connection', socket => {
          socket.emit('project', this.reports.project);
          socket.emit('progress', this.reports.progress);
          socket.emit('stats', this.reports.stats);

          socket.on('build:prod', () => {
            const prodCompiler = webpack(this.options.webpackConfig({ production: true }));

            prodCompiler.apply(
              new webpack.ProgressPlugin((percentage, message) => {
                this.reports.progress = { percentage, message };
                player.io.emit("progress", { percentage, message });
              })
            );

            prodCompiler.run((err, stats) => {
              const jsonStats = stats.toJson({ chunkModules: true });
              jsonStats.isDev = isDev;
              this.reports.stats = reporter.statsReporter(jsonStats);
              player.io.emit("stats", this.reports.stats);
            });

          });
        });
      });
    }

    compiler.plugin("watch-run", (c, done) => {
      this.env.watching = true;
      done();
    });

    compiler.plugin("run", (c, done) => {
      this.env.watching = false;
      done();
    });

    // report the webpack compiler progress
    compiler.apply(
      new webpack.ProgressPlugin((percentage, message) => {
        this.reports.progress = { percentage, message };
        player.io.emit("progress", { percentage, message });
      })
    );

    // extract the final reports from the stats!
    compiler.plugin("done", stats => {
      if (!this.env.running) return;

      const jsonStats = stats.toJson({ chunkModules: true });
      jsonStats.isDev = isDev;
      this.reports.stats = reporter.statsReporter(jsonStats);
      player.io.emit("stats", this.reports.stats);
    });

  }
}

function parseAuthor(author) {
  if (author && author.name) return author;

  if (typeof author === "string") {
    const authorsArray = authors(author);
    if (authorsArray.length > 0) {
      return authorsArray[0];
    }
  }

  return { name: "", email: "", url: "" };
};

module.exports = PlayerDashboard;
