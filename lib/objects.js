(function() {
  var Point, ProfilerReport, Report, Sequelize, Utils, sequelize;

  Utils = require('./utils');

  Sequelize = require('sequelize');

  sequelize = Utils.connect();

  Report = sequelize.define('Report', {
    metric: {
      type: Sequelize.STRING,
      allowNull: false
    },
    key: {
      type: Sequelize.STRING,
      allowNull: false
    },
    sha: {
      type: Sequelize.STRING,
      allowNull: false
    },
    human: {
      type: Sequelize.STRING,
      allowNull: false
    },
    userAgent: {
      type: Sequelize.STRING,
      allowNull: true
    },
    os: {
      type: Sequelize.STRING,
      allowNull: true
    }
  }, {
    underscore: true,
    classMethods: {
      truncateKeyPattern: function(key) {
        var query;

        query = Report.findAll({
          where: {
            key: "LIKE '%" + key + "%'"
          }
        }).on('success', function(reports) {
          var report, _i, _len, _results;

          _results = [];
          for (_i = 0, _len = reports.length; _i < _len; _i++) {
            report = reports[_i];
            _results.push(report.destroyWithPoints());
          }
          return _results;
        });
        return query;
      },
      getAvailableKeys: function() {
        return sequelize.query("SELECT DISTINCT `key` FROM `Reports`;", {
          build: function(x) {
            return x.key;
          }
        });
      }
    },
    instanceMethods: {
      destroyWithPoints: function() {
        var _this = this;

        return this.getPoints().on('success', function(points) {
          var point, _i, _len;

          for (_i = 0, _len = points.length; _i < _len; _i++) {
            point = points[_i];
            point.destroy();
          }
          return _this.destroy();
        });
      }
    }
  });

  Point = sequelize.define('Point', {
    x: {
      type: Sequelize.FLOAT,
      allowNull: false
    },
    y: {
      type: Sequelize.FLOAT,
      allowNull: false
    },
    note: {
      type: Sequelize.STRING,
      allowNull: true
    }
  }, {
    underscore: true
  });

  ProfilerReport = sequelize.define('ProfilerReport', {
    text: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    test: {
      type: Sequelize.STRING,
      allowNull: false
    },
    branch: {
      type: Sequelize.STRING,
      allowNull: false
    },
    human: {
      type: Sequelize.STRING,
      allowNull: false
    },
    sha: {
      type: Sequelize.STRING,
      allowNull: false
    }
  });

  Report.hasMany(Point);

  Point.belongsTo(Report);

  module.exports = {
    Report: Report,
    Point: Point,
    ProfilerReport: ProfilerReport
  };

}).call(this);
