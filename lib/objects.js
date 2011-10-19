(function() {
  var Point, Report, Sequelize, Utils, sequelize;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
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
    }
  }, {
    underscore: true,
    classMethods: {
      truncateKey: function(key) {
        return Report.findAll({
          where: {
            key: key
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
        return this.getPoints().on('success', __bind(function(points) {
          var point, _i, _len;
          for (_i = 0, _len = points.length; _i < _len; _i++) {
            point = points[_i];
            point.destroy();
          }
          return this.destroy();
        }, this));
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
  Report.hasMany(Point);
  Point.belongsTo(Report);
  sequelize.sync().on('failure', function(error) {
    throw error;
  });
  module.exports = {
    Report: Report,
    Point: Point
  };
}).call(this);
