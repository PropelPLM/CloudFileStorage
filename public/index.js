$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const fileName = $("#file-name");
  const tooltipWrapper = $("#tooltip-wrapper");
  const tooltip = $("#tooltip");
  const fileSelect = $("#file-select");
  const uploadConfirm = $("#upload-confirm");
  const status = $("#status");
  const details = $("#details");
  const dropzone = $("#dropzone");
  const progressBar = $("#progress-bar");
  const progressBarText = $("#progress-bar-text");

  const dropFilesDefaultText = "Or drop files here!";
  const socket = io();

  socket.on('progress', progress => {
    const percentageCompletion = parseInt(progress.percentage);
    progressBar.css('width', `${parseInt(percentageCompletion)}%`);
    progressBarText.text(`${percentageCompletion}%`);
  });

  socket.on('test', p => {
    progressBar.css('width', `${parseInt(p)}%`);
    progressBarText.text(`${p}% Complete`);
  });

  [
    "drag",
    "dragstart",
    "dragend",
    "dragover",
    "dragenter",
    "dragleave",
    "drop"
  ].forEach(function (event) {
    dropzone.on(event, function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  fileName.hover(
    function () {
      tooltipWrapper.css("visibility", "visible");
    },
    function () {
      tooltipWrapper.css("visibility", "hidden");
    }
  );

  fileSelect.on("change", function (e) {
    e.preventDefault();
    var inputFileName = String.raw`${$(this).val()}`;
    if (inputFileName) {
      uploadConfirm.prop('disabled', false);
      uploadConfirm.removeClass('isDisabled');
    } else {
      uploadConfirm.prop('disabled', true);
      uploadConfirm.addClass('isDisabled');
    }
    progressBar.css('width', `0%`);
    progressBarText.text(`0% Complete`);
    reflectNameChange(inputFileName);
  });

  dropzone.on("drop", e => {
    var files = e.target.files;
    if (!files || files.length === 0)
      files = e.dataTransfer
        ? e.dataTransfer.files
        : e.originalEvent.dataTransfer.files;
    reflectNameChange(files[0].name);
    fileSelect.prop("files", files);
  });

  uploadConfirm.click(event => {
    event.preventDefault();
    uploadFile(fileSelect.prop("files")[0]);
  });

  const reflectNameChange = async inputFileName => {
    if (!inputFileName) {
      inputFileName = dropFilesDefaultText;
    } else {
      if (inputFileName.lastIndexOf("/") + 1 !== 0) {
        inputFileName = inputFileName.substr(
          inputFileName.lastIndexOf("/") + 1
        );
      } else {
        inputFileName = inputFileName.substr(
          inputFileName.lastIndexOf("\\") + 1
        );
      }
    }
    fileName.text(inputFileName);
    tooltip.text(inputFileName);
  };

  const uploadFile = fileData => {
    var data = new FormData();
    data.append("file", fileData);
    axios
      .post(`/upload`, data)
      .then(res => {
        window.parent.postMessage(JSON.parse(JSON.stringify(res)), '*')
      })
  };
});
