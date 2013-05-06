Utils = require './utils'
Sequelize = require 'sequelize'
sequelize = Utils.connect()

Report = sequelize.define 'Report',
  metric:
    type: Sequelize.STRING
    allowNull: false
  key:
    type: Sequelize.STRING
    allowNull: false
  sha:
    type: Sequelize.STRING
    allowNull: false
  human:
    type: Sequelize.STRING
    allowNull: false
  userAgent:
    type: Sequelize.STRING
    allowNull: false
  os:
    type: Sequelize.STRING
    allowNull: false
,
  underscore: true
  classMethods:
    truncateKeyPattern: (key) ->
      query = Report.findAll({where: key: "LIKE '%#{key}%'"}).on 'success', (reports) ->
        report.destroyWithPoints() for report in reports
      query

    getAvailableKeys: ->
      sequelize.query "SELECT DISTINCT `key` FROM `Reports`;", {build: (x) -> x.key}

  instanceMethods:
    destroyWithPoints: ->
      @getPoints().on 'success', (points) =>
        point.destroy() for point in points
        @destroy()

Point = sequelize.define 'Point',
  x:
    type: Sequelize.FLOAT
    allowNull: false
  y:
    type: Sequelize.FLOAT
    allowNull: false
  note:
    type: Sequelize.STRING
    allowNull: true
,
  underscore: true


Report.hasMany Point
Point.belongsTo Report

module.exports = {Report, Point}
