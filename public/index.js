$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const form = $('#form');
  const fileName = $('#file-name');
  const fileSelect = $('#file-select');
  const progressContainer = $('#progress-container');
  const errorContainer = $('#error-container');
  const progressBar = $('#progress-bar');
  const progressBarText = $('#progress-bar-text');
  const spinner = $('#spinner');
  const check = $('#check');
  const overallFileProgress = $('#overall-file-progress');
  const socket = io();
  let numFiles = 0;

  // INIT
  const resetIcons = () => {
    check.css('visibility', 'hidden');
    spinner.css('visibility', 'hidden');
    $('#js-status').css('display', 'block');
  };
  resetIcons();

  const instanceKeyFinder = () => {
    const url = $(location).attr('href').slice(0, -1);
    return url.substr(url.slice(0, -1).lastIndexOf('/') + 1);
  };
  socket.emit('start', instanceKeyFinder());

  //SOCKET IO HELPERS
  socket.on('setAttribute', (object) => {
    Object.entries(object).forEach(([key, value]) => {
      form.attr(`data-${key}`, value);
    });
  });

  socket.on('trigger', ({ topic, payload }) => {
    window.parent.postMessage(
      {
        type: topic,
        data: payload,
      },
      form.data(`target-window`)
    );
  });

  const trackProgress = async () => {
    await socket.on('progress', percent => {
      const displayPercent = Math.min(100, percent)
      progressBar.css('width', `${displayPercent}%`);
      progressBarText.text(`${displayPercent}%`);
      if (displayPercent === 100) {
        spinner.css('visibility', 'visible');
      }
    });
  };

  //DOM MANIPULATION JQUERY
  // fileSelect.on('click', function (e) {
  //   if (!form.data(`instance-key`) && !form.data(`target-window`)) {
  //     axios.get(`/setAttribute/${instanceKeyFinder()}`);
  //   }
  // });

  const setFilesUploaded = () => {
    overallFileProgress.text(`${numFiles} uploaded!`);
  };

  const uploadFile = async (files) => {
    const instanceKey = form.data(`instance-key`);
    var data = new FormData();
    let file;
    for (var i = 0; i < numFiles; i++) {
      file = files[i];
      data.append('fileSize', `${file.name}__${instanceKey}__${file.size}`);
      data.append('file', file);
    }
    await trackProgress();
    let targetWindow = form.data(`target-window`);
    let uploadResult;
    try {
      uploadResult = await axios.post(
        `/upload/${instanceKey}`,
        data,
        {
          headers: {'Content-Type': 'application/json'}
        }
      );
      socket.off('progress');
      spinner.css('visibility', 'hidden');
      check.css('visibility', 'visible');
      const type = uploadResult.data.isNew ? 'uploadNew' : 'uploadExisting';
      window.parent.postMessage({ type, ...uploadResult.data }, targetWindow);
      targetWindow = targetWindow.substring(0, targetWindow.indexOf('.')+ 1) + 'lightning.force.com'
      window.parent.postMessage({ type, ...uploadResult.data }, targetWindow);
      setFilesUploaded();
    } catch (err) {
      spinner.css('visibility', 'hidden');
      errorContainer.css('visibility', 'visible');
      errorContainer.text(`${err.response.data} Please refresh.`)
    }
  };

  const toggleButtonDisable = () => {
    fileSelect.prop('disabled', !fileSelect.prop('disabled'));
    fileSelect.toggleClass('disabled');
  }

  const uploadsCompleteResetState = () => {
    const instanceKey = form.data(`instance-key`);
    axios.post(`/upload/reset/${instanceKey}`);
    numFiles = 0;
    toggleButtonDisable();
  }

  fileSelect.on('change', async function (e) {
    e.preventDefault();
    resetIcons();

    const files = fileSelect.prop('files');
    numFiles = files.length;
    overallFileProgress.text('');

    const firstFile = fileSelect.prop('files')[0];
    if (files.length > 0) {
      toggleButtonDisable();
      progressBar.css('width', `0%`);
      progressBarText.text(`0%`);
      fileName.text(numFiles > 1 ? 'Multiple files are being uploaded...' : firstFile.name);
      progressContainer.css('visibility', 'visible');
      await uploadFile(files);
      uploadsCompleteResetState();
    } else {
      fileName.text('');
      progressContainer.css('visibility', 'hidden');
    }
  });
});
