var dimensions = [
  "AD",
  "ANALYTICS_VERSION",
  "ASN",
  "AUDIO_BITRATE",
  "AUTOPLAY",
  "BROWSER",
  "BROWSER_VERSION_MAJOR",
  "BUFFERED",
  "CDN_PROVIDER",
  "CITY",
  "CLIENT_TIME",
  "COUNTRY",
  "CUSTOM_DATA_1",
  "CUSTOM_DATA_2",
  "CUSTOM_DATA_3",
  "CUSTOM_DATA_4",
  "CUSTOM_DATA_5",
  "CUSTOM_USER_ID",
  "DEVICE_TYPE",
  "DOMAIN",
  "DRM_LOAD_TIME",
  "DRM_TYPE",
  "DROPPED_FRAMES",
  "DURATION",
  "ERROR_CODE",
  "EXPERIMENT_NAME",
  "IMPRESSION_ID",
  "IP_ADDRESS",
  "IS_CASTING",
  "IS_LIVE",
  "IS_MUTED",
  "ISP",
  "LANGUAGE",
  "LICENSE_KEY",
  "MPD_URL",
  "M3U8_URL",
  "PATH",
  "PAUSED",
  "PLAYED",
  "PLAYER",
  "PLAYER_KEY",
  "PLAYER_STARTUPTIME",
  "PLAYER_TECH",
  "PLAYER_VERSION",
  "REGION",
  "SCALE_FACTOR",
  "SCREEN_HEIGHT",
  "SCREEN_WIDTH",
  "SEEKED",
  "SIZE",
  "STARTUPTIME",
  "STREAM_FORMAT",
  "USER_ID",
  "VIDEO_BITRATE",
  "VIDEO_DURATION",
  "VIDEO_ID",
  "VIDEO_PLAYBACK_HEIGHT",
  "VIDEO_PLAYBACK_WIDTH",
  "VIDEO_STARTUPTIME",
  "VIDEO_WINDOW_HEIGHT",
  "VIDEO_WINDOW_WIDTH",
  "VIDEOTIME_END",
  "VIDEOTIME_START",
  "OPERATINGSYSTEM",
  "OPERATINGSYSTEM_VERSION_MAJOR",
  "PAGE_LOAD_TIME",
  "PAGE_LOAD_TYPE",
  "PROG_URL"
];

(function() {
  // Create the connector object
  var myConnector = tableau.makeConnector();

  // Define the schema
  myConnector.getSchema = function(schemaCallback) {
    var request = JSON.parse(tableau.connectionData);
    var cols = [];

    if (request.interval !== "NONE") {
      cols.push({
        id: "time",
        dataType: tableau.dataTypeEnum.datetime
      });
    }

    request.groupBy.forEach(function(field) {
      cols.push({
        id: field
      });
    });

    cols.push({
      id: "dimension",
      alias: request.aggregation.toUpperCase() + " " + request.dimension,
      dataType: tableau.dataTypeEnum.float,
      columnRole: tableau.columnRoleEnum.measure
    });

    var tableSchema = {
      id: "analytics",
      alias: "Bitmovin Analytics data",
      columns: cols
    };

    schemaCallback([tableSchema]);
  };

  function responseToRows(request, response) {
    var groupByStartIndex = 0;
    var hasInterval = false;
    if (request.interval && request.interval !== "NONE") {
      groupByStartIndex = 1;
      hasInterval = true;
    }

    return response.map(row => {
      var result = {};
      if (hasInterval) {
        result.time = moment(row[0]).toDate();
      }
      request.groupBy.map(
        (groupBy, index) => (result[groupBy] = row[index + groupByStartIndex])
      );
      result.dimension = row[row.length - 1];
      return result;
    });
  }

  // Download the data
  myConnector.getData = function(table, doneCallback) {
    var connectionData = JSON.parse(tableau.connectionData);

    var data = {
      orderBy: [],
      groupBy: connectionData.groupBy,
      filters: connectionData.filters,
      dimension: connectionData.dimension,
      licenseKey: connectionData.licenseKey,
      start: connectionData.startDate,
      end: connectionData.endDate
    };

    if (connectionData.interval !== "NONE") {
      data.interval = connectionData.interval;
    }
    if (connectionData.limit) {
      data.limit = connectionData.limit;
    }
    if (connectionData.offset) {
      data.offset = connectionData.offset;
    }

    var options = {
      url: [
        "https://api.bitmovin.com/v1/analytics/queries/",
        connectionData.aggregation
      ].join(""),
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": connectionData.apiKey
      },
      data: JSON.stringify(data)
    };

    $.ajax(options)
      .done(function(json) {
        if (json.data && json.data.result && json.data.result.rows) {
          var tableData = responseToRows(data, json.data.result.rows);
          table.appendRows(tableData);
        }

        doneCallback();
      })
      .fail(function(jqxhr, textStatus, error) {
        var err = textStatus + ", " + error;
        tableau.log("Error fetching data: " + err);
        if (jqxhr.responseJSON) {
          tableau.log("Response: ");
          tableau.log(jqxhr.responseJSON);
        }
        doneCallback();
      });
  };

  tableau.registerConnector(myConnector);

  function validateAndGetValue(input, getValue) {
    var isValid = true;
    var value = getValue(input);
    input.removeClass("is-invalid");
    if ((input.required || input.hasClass("required")) && !value) {
      isValid = false;
      input.addClass("is-invalid");
    }

    return {
      isValid,
      value
    };
  }
  // Create event listeners for when the user submits the form
  $(document).ready(function() {
    var selectDimension = $("#selectDimension");

    $.each(dimensions, function() {
      selectDimension.append(
        $("<option />")
          .val(this)
          .text(this)
      );
    });

    $(".input-group.date").datetimepicker();
    $("#datePickerTo")
      .data("datetimepicker")
      .date(moment());
    $("#datePickerFrom")
      .data("datetimepicker")
      .date(moment().subtract(7, "days"));

    $("#submitButton").click(function(e) {
      var temp = validateAndGetValue($("#inputApiKey"), input => input.val());
      var isValid = temp.isValid;
      var apiKey = temp.value;

      temp = validateAndGetValue($("#inputLicenseKey"), input => input.val());
      isValid &= temp.isValid;
      var licenseKey = temp.value;

      temp = validateAndGetValue($("#selectAggregation"), input => input.val());
      isValid &= temp.isValid;
      var aggregation = temp.value;

      temp = validateAndGetValue($("#selectInterval"), input => input.val());
      isValid &= temp.isValid;
      var interval = temp.value;

      temp = validateAndGetValue($("#selectDimension"), input => input.val());
      isValid &= temp.isValid;
      var dimension = temp.value;

      temp = validateAndGetValue($("#inputFilter"), input => input.val());
      isValid &= temp.isValid;
      var filters = [];
      if (temp.value.length > 0) {
        try {
          filters = eval("([" + temp.value + "])");
        } catch (e) {
          $("#inputFilter").addClass("is-invalid");
          isValid = false;
        }
      }

      temp = validateAndGetValue($("#inputLimit"), input => input.val());
      isValid &= temp.isValid;
      var limit = temp.value;

      temp = validateAndGetValue($("#inputOffset"), input => input.val());
      isValid &= temp.isValid;
      var offset = temp.value;

      temp = validateAndGetValue($("#inputGroupBy"), input => input.val());
      isValid &= temp.isValid;
      var groupBy = [];
      if (temp.value.length > 0) {
        try {
          temp.value = temp.value.replace(",", '","');
          groupBy = eval('(["' + temp.value + '"])').map(v => v.trim());
        } catch (e) {
          $("#inputGroupBy").addClass("is-invalid");
          isValid = false;
        }
      }

      temp = validateAndGetValue($("#datePickerFrom"), input =>
        input.data("datetimepicker").date()
      );
      isValid &= temp.isValid;
      var startDate = temp.value;

      temp = validateAndGetValue($("#datePickerTo"), input =>
        input.data("datetimepicker").date()
      );
      isValid &= temp.isValid;
      var endDate = temp.value;

      if (!isValid) {
        e.preventDefault();
        return;
      }

      var request = {
        apiKey,
        licenseKey,
        aggregation,
        dimension,
        filters,
        groupBy,
        limit,
        offset,
        interval,
        startDate,
        endDate
      };
      tableau.connectionData = JSON.stringify(request);
      tableau.connectionName = "Bitmovin Analytics";
      tableau.submit();
    });
  });
})();
