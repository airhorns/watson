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
,
  underscore: true
  classMethods:
    truncateKey: (key) ->
      Report.findAll({where: {key: key}}).on 'success', (reports) ->
        report.destroyWithPoints() for report in reports

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
