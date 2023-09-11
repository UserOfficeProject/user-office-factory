export const pagedJs = `<script src="http://localhost:${
  process.env.NODE_PORT || 4500
}/static/js/paged.polyfill.min.js"></script>`;

export const computeTableOfContents = `
  <script>
    function createIndex(config) {
      let indexElements = document.querySelectorAll("[data-book-index]");
      let indices = [];
      let num = 0;
      for (let i = 0; i < indexElements.length; ++i) {
        let indexElement = indexElements[i];

        // create array with all data-book-index
        let indexKey = indexElement.dataset.bookIndex;
        let indexKeyFirst = indexKey.slice(0, 1);

        let indexParent = indexElement.dataset.bookIndexParent;
        indices.push({ indexKey, indexParent });

        // create id for span whithout
        num++;
        if (indexElement.id == '') {
          indexElement.id = 'book-index-' + num;
        }
      }

      // create <ul> element for the index
      let indexElementDiv = document.querySelector(config.indexElement);
      let indexUl = document.createElement('ul');
      indexUl.id = 'list-index-generated';
      indexElementDiv.appendChild(indexUl);

      // create <li> element for the index
      indices.forEach((index) => {
        // create <li> element for the index
        let indexNewLi = document.createElement('li');
        indexNewLi.classList.add('list-index-element');

        const indexKey = index.indexKey;
        const indexParent = index.indexParent;

        indexNewLi.dataset.listIndex = indexKey;
        if (indexParent) indexNewLi.dataset.listIndexParent = indexParent;
        indexUl.appendChild(indexNewLi);
      });

      let indexLi = document
        .getElementById('list-index-generated')
        .getElementsByClassName('list-index-element');

      for (var n = 0; n < indexLi.length; n++) {
        // find data and add HTML of the list
        let dataIndex = indexLi[n].dataset.listIndex;
        let spanIndex = document.querySelectorAll(
          "[data-book-index='" + dataIndex + "']"
        );
        indexLi[n].innerHTML =
          '<span class="index-value">' +
          dataIndex +
          '</span><span class="links-pages"></span>';

        // add span for link page
        spanIndex.forEach(function (elem) {
          spanIndexId = elem.id;
          let spanPage = document.createElement('span');
          spanPage.classList.add('link-page');
          spanPage.innerHTML = '<a href="#' + spanIndexId + '"></a>';
          indexLi[n]
            .getElementsByClassName('links-pages')[0]
            .appendChild(spanPage);
        });
      }
    }

    createIndex({
      indexElement: '#bookIndex',
    });
  </script>
`;
