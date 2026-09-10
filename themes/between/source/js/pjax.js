(function () {
  'use strict';

  if (!window.Swup || !document.querySelector('#main-content')) return;

  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var directionTimer;
  var navigationInProgress = false;
  var loadingTimer;
  var loadingStartedAt = 0;
  var loadingIndicator = document.querySelector('[data-page-loading]');

  function setPageLoading(active) {
    if (!loadingIndicator) return;
    window.clearTimeout(loadingTimer);
    if (active) {
      if (!loadingIndicator.classList.contains('is-visible')) loadingStartedAt = Date.now();
      loadingIndicator.classList.add('is-visible');
      loadingIndicator.setAttribute('aria-hidden', 'false');
      return;
    }

    var minimumVisibleTime = 320;
    var elapsed = Date.now() - loadingStartedAt;
    var finishDelay = Math.max(0, minimumVisibleTime - elapsed);
    loadingTimer = window.setTimeout(function () {
      loadingIndicator.classList.remove('is-visible');
      loadingIndicator.setAttribute('aria-hidden', 'true');
    }, finishDelay);
  }

  function cancelPageLoading() {
    if (!loadingIndicator) return;
    window.clearTimeout(loadingTimer);
    loadingIndicator.classList.remove('is-visible');
    loadingIndicator.setAttribute('aria-hidden', 'true');
  }

  function articlePath(url) {
    var pathname = new URL(url || window.location.href, window.location.href).pathname;
    return /^\/archives\/[^/]+\/?$/.test(pathname);
  }

  function setNavigationDirection(visit) {
    window.clearTimeout(directionTimer);
    root.classList.remove('is-opening-article', 'is-closing-article');
    var fromArticle = articlePath(visit.from.url);
    var toArticle = articlePath(visit.to.url);
    if (!fromArticle && toArticle) root.classList.add('is-opening-article');
    if (fromArticle && !toArticle) root.classList.add('is-closing-article');
    directionTimer = window.setTimeout(function () {
      root.classList.remove('is-opening-article', 'is-closing-article');
    }, 1300);
  }

  function closeMobileMenu() {
    var button = document.querySelector('[data-menu-toggle]');
    var menu = document.getElementById('mobile-menu');
    if (!button || !menu) return;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open navigation');
    menu.classList.remove('is-open');
    menu.hidden = true;
    menu.setAttribute('aria-hidden', 'true');
    root.classList.remove('menu-open');
  }

  function syncHead(html) {
    var next = new DOMParser().parseFromString(html, 'text/html');
    document.body.className = next.body.className;

    var nextDescription = next.querySelector('meta[name="description"]');
    var description = document.querySelector('meta[name="description"]');
    if (nextDescription && description) description.content = nextDescription.content;

    var nextCanonical = next.querySelector('link[rel="canonical"]');
    var canonical = document.querySelector('link[rel="canonical"]');
    if (nextCanonical && canonical) canonical.href = nextCanonical.href;

  }

  function updateActiveNavigation() {
    var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.nav-link, .mobile-nav-links a').forEach(function (link) {
      var path = new URL(link.href, window.location.href).pathname.replace(/\/+$/, '') || '/';
      var active = path === '/' ? currentPath === '/' : currentPath === path || currentPath.indexOf(path + '/') === 0;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function initializeCopyButtons() {
    document.querySelectorAll('.article-content > pre > code').forEach(function (code) {
      var block = code.parentElement;
      if (block.querySelector('.code-copy')) return;
      var button = document.createElement('button');
      var copyIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      var copiedIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
      button.className = 'code-copy';
      button.type = 'button';
      button.innerHTML = copyIcon;
      button.setAttribute('aria-label', 'Copy code');
      button.setAttribute('title', 'Copy code');
      button.addEventListener('click', function () {
        var action = navigator.clipboard
          ? navigator.clipboard.writeText(code.textContent)
          : Promise.reject(new Error('Clipboard is unavailable'));
        action.then(function () {
          button.innerHTML = copiedIcon;
          button.classList.add('is-copied');
          window.setTimeout(function () {
            button.innerHTML = copyIcon;
            button.classList.remove('is-copied');
          }, 1200);
        }).catch(function () {});
      });
      block.appendChild(button);
    });
  }

  function initializeShareButtons() {
    document.querySelectorAll('[data-share]').forEach(function (button) {
      button.addEventListener('click', function () {
        var data = { title: document.title, url: window.location.href };
        var action = navigator.share
          ? navigator.share(data)
          : navigator.clipboard
            ? navigator.clipboard.writeText(data.url)
            : Promise.reject(new Error('Sharing is unavailable'));
        Promise.resolve(action).then(function () {
          button.classList.add('is-copied');
          window.setTimeout(function () { button.classList.remove('is-copied'); }, 800);
        }).catch(function () {});
      });
    });
  }

  function initializeDeferredImages() {
    var images = Array.prototype.slice.call(document.querySelectorAll('[data-deferred-image]'));
    var observer;

    function loadImage(image) {
      if (image.dataset.deferredState) return;
      var shell = image.closest('[data-deferred-image-shell]');
      image.dataset.deferredState = 'loading';
      image.hidden = false;
      if (shell) {
        shell.classList.add('is-loading');
        shell.setAttribute('aria-busy', 'true');
      }

      function reveal() {
        image.dataset.deferredState = 'loaded';
        if (shell) {
          shell.classList.remove('is-loading');
          shell.classList.add('is-loaded');
          shell.setAttribute('aria-busy', 'false');
        }
      }

      function fail() {
        image.dataset.deferredState = 'error';
        image.hidden = true;
        if (shell) {
          shell.classList.remove('is-loading');
          shell.classList.add('is-error');
          shell.setAttribute('aria-busy', 'false');
        }
      }

      image.addEventListener('load', function () {
        if (image.decode) image.decode().catch(function () {}).then(reveal);
        else reveal();
      }, { once: true });
      image.addEventListener('error', fail, { once: true });
      if (image.dataset.deferredSrcset) image.srcset = image.dataset.deferredSrcset;
      image.src = image.dataset.deferredSrc;
      if (image.complete) {
        if (image.naturalWidth > 0) reveal();
        else fail();
      }
    }

    if (!images.length) return function () {};
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          loadImage(entry.target);
        });
      }, { rootMargin: '360px 0px' });
      images.forEach(function (image) { observer.observe(image); });
    } else {
      images.forEach(loadImage);
    }

    return function () { if (observer) observer.disconnect(); };
  }

  function initializeExpandButtons() {
    document.querySelectorAll('[data-onchain-expand]').forEach(function (button) {
      button.addEventListener('click', function () {
        var wrapper = button.closest('.onchain-value-wrap');
        if (!wrapper) return;
        var expanded = wrapper.classList.toggle('is-expanded');
        var field = button.dataset.label || 'address';
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute('aria-label', (expanded ? 'Collapse ' : 'Show full ') + field);
        button.setAttribute('title', (expanded ? 'Collapse ' : 'Show full ') + field);
      });
    });
  }

  function initializeGreeting() {
    var greeting = document.querySelector('[data-typing-greeting]');
    if (!greeting) return function () {};
    var phrases;
    try {
      phrases = JSON.parse(greeting.dataset.phrases || '[]');
    } catch (error) {
      phrases = [];
    }
    var heading = greeting.closest('h1');
    var timer;
    var stopped = false;
    var phraseIndex = 0;
    var characterIndex = phrases.length ? Array.from(phrases[0]).length : 0;
    var deleting = true;

    function visible() {
      if (!heading || !heading.isConnected) return false;
      var rect = heading.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    }

    function fit(phrase) {
      if (!heading) return;
      heading.style.removeProperty('font-size');
      if (window.innerWidth > 767 || !phrases.length) return;
      var original = greeting.textContent;
      var fontSize = parseFloat(window.getComputedStyle(heading).fontSize);
      greeting.textContent = phrase || original;
      while (fontSize > 24 && heading.scrollWidth > heading.clientWidth) {
        fontSize -= 1;
        heading.style.fontSize = fontSize + 'px';
      }
      greeting.textContent = original;
    }

    function schedule(delay) {
      timer = window.setTimeout(typeNext, delay);
    }

    function typeNext() {
      if (stopped || reducedMotion || phrases.length < 2) return;
      if (!visible()) {
        schedule(400);
        return;
      }
      var characters = Array.from(phrases[phraseIndex]);
      if (deleting) {
        characterIndex -= 1;
        greeting.textContent = characters.slice(0, characterIndex).join('');
        if (characterIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          fit(phrases[phraseIndex]);
          schedule(320);
        } else schedule(58);
        return;
      }
      characters = Array.from(phrases[phraseIndex]);
      characterIndex += 1;
      greeting.textContent = characters.slice(0, characterIndex).join('');
      if (characterIndex === characters.length) {
        deleting = true;
        schedule(2200);
      } else schedule(112);
    }

    function resize() { if (visible()) fit(phrases[phraseIndex] || phrases[0]); }
    fit(phrases[0]);
    window.addEventListener('resize', resize);
    if (!reducedMotion && phrases.length > 1) schedule(2200);
    return function () {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
    };
  }

  function initializeLatestBlock() {
    var value = document.querySelector('[data-latest-block]');
    if (!value) return function () {};
    var timer;
    var request;
    var stopped = false;
    var firstRequest = true;
    var ticker = value.querySelector('.block-ticker');
    var wrapper = value.closest('.onchain-value-wrap');

    function render(blockNumber) {
      var current = value.querySelector('[data-block-number]');
      var nextValue = String(blockNumber);
      if (!current || current.textContent.trim() === nextValue) return;
      if (reducedMotion || !ticker) {
        current.textContent = nextValue;
        return;
      }
      var next = document.createElement('span');
      next.dataset.blockNumber = '';
      next.className = 'is-entering';
      next.textContent = nextValue;
      ticker.appendChild(next);
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          current.classList.add('is-leaving');
          next.classList.remove('is-entering');
        });
      });
      window.setTimeout(function () { current.remove(); }, 340);
    }

    function schedule(delay) {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, delay);
    }

    function refresh() {
      if (stopped) return;
      if (document.hidden) {
        schedule(4000);
        return;
      }
      request = new AbortController();
      if (firstRequest && wrapper) wrapper.classList.add('is-block-loading');
      var timeout = window.setTimeout(function () { request.abort(); }, 5000);
      fetch(value.dataset.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        signal: request.signal
      }).then(function (response) {
        if (!response.ok) throw new Error('Polygon RPC request failed');
        return response.json();
      }).then(function (payload) {
        if (!payload.result) throw new Error('Polygon RPC returned no block number');
        render(parseInt(payload.result, 16));
        if (wrapper) wrapper.classList.add('is-live');
      }).catch(function () {
        if (!stopped && wrapper) wrapper.classList.remove('is-live');
      }).finally(function () {
        window.clearTimeout(timeout);
        if (firstRequest && wrapper) wrapper.classList.remove('is-block-loading');
        firstRequest = false;
        schedule(4000);
      });
    }

    if (value.querySelector('[data-block-number]')) refresh();
    return function () {
      stopped = true;
      window.clearTimeout(timer);
      if (request) request.abort();
    };
  }

  function initializeToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.article-toc a'));
    var observer;
    if (!links.length) return function () {};
    links[0].classList.add('is-active');
    if ('IntersectionObserver' in window) {
      var byId = {};
      links.forEach(function (link) {
        var id = decodeURIComponent(link.hash.slice(1));
        if (id) byId[id] = link;
      });
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || !byId[entry.target.id]) return;
          links.forEach(function (link) { link.classList.remove('is-active'); });
          byId[entry.target.id].classList.add('is-active');
        });
      }, { rootMargin: '-18% 0px -72% 0px' });
      Object.keys(byId).forEach(function (id) {
        var heading = document.getElementById(id);
        if (heading) observer.observe(heading);
      });
    }
    return function () { if (observer) observer.disconnect(); };
  }

  function initializeSearch() {
    var input = document.querySelector('[data-post-search]');
    if (!input) return;
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-post-group]'));
    var empty = document.querySelector('[data-empty-search]');
    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      var visibleCount = 0;
      groups.forEach(function (group) {
        var count = 0;
        group.querySelectorAll('[data-search-value]').forEach(function (row) {
          var visible = !query || row.dataset.searchValue.indexOf(query) !== -1;
          row.hidden = !visible;
          if (visible) count += 1;
        });
        group.hidden = count === 0;
        visibleCount += count;
      });
      if (empty) empty.hidden = visibleCount !== 0;
    });
  }

  function initializePageEntrance() {
    if (reducedMotion) return function () {};
    var selectors = [
      '.about-intro h1',
      '.about-intro > p',
      '.about-intro .text-links',
      '.about-details > .details-column',
      '.blog-shell > .search-field',
      '.blog-shell > .post-group',
      '.friends-header > *',
      '.friend-card',
      '.friends-provenance',
      '.article-header > *',
      '.article-origin',
      '.article-content',
      '.article-footer',
      '.simple-page > *'
    ];
    var items = Array.prototype.slice.call(document.querySelectorAll(selectors.join(',')));
    var timer;

    items.forEach(function (item, index) {
      item.classList.add('page-enter-item');
      item.style.setProperty('--page-enter-order', String(Math.min(index, 7)));
    });

    function clear() {
      window.clearTimeout(timer);
      items.forEach(function (item) {
        item.classList.remove('page-enter-item');
        item.style.removeProperty('--page-enter-order');
      });
    }

    timer = window.setTimeout(clear, 1100);
    return clear;
  }

  function initializePage() {
    var cleanups = [initializeDeferredImages(), initializeGreeting(), initializeLatestBlock(), initializeToc(), initializePageEntrance()];
    initializeCopyButtons();
    initializeShareButtons();
    initializeExpandButtons();
    initializeSearch();
    window.sitePageCleanup = function () {
      cleanups.forEach(function (cleanup) { cleanup(); });
      window.sitePageCleanup = null;
    };
  }

  var swup = new window.Swup({
    containers: ['#main-content', '.site-footer'],
    animateHistoryBrowsing: true,
    animationSelector: false,
    cache: true,
    native: false,
    hooks: {
      'link:click': function () {
        setPageLoading(true);
      },
      'visit:start': function (visit) {
        navigationInProgress = true;
        setPageLoading(true);
        root.classList.add('is-pjax-ready');
        root.classList.add('is-content-leaving');
        setNavigationDirection(visit);
        visit.animation.animate = false;
        cancelVisiblePrefetch();
        if (window.sitePageCleanup) window.sitePageCleanup();
      },
      'page:load': function () {
        closeMobileMenu();
      },
      'content:replace': function (visit, args) {
        syncHead(args.page.html);
      },
      'page:view': function () {
        root.classList.remove('is-content-leaving');
        root.classList.remove('is-history-return');
        updateActiveNavigation();
        initializePage();
        navigationInProgress = false;
        setPageLoading(false);
        document.dispatchEvent(new CustomEvent('site:page-view'));
      },
      'visit:error': function () {
        navigationInProgress = false;
        root.classList.remove('is-content-leaving');
        cancelPageLoading();
      }
    }
  });

  window.setTimeout(function () { root.classList.add('is-pjax-ready'); }, 280);

  var activePrefetches = new Set();
  var queuedPrefetches = [];
  var queuedPrefetchKeys = new Set();
  var prefetchQueueRunning = false;
  var visiblePrefetchTimer;
  var visiblePrefetchIdle;
  var visiblePrefetchLoadHandler;

  function prefetch(link) {
    if (!link || swup.shouldIgnoreVisit(link.href, { el: link })) return Promise.resolve();
    var destination = new URL(link.href, window.location.href);
    var key = destination.pathname + destination.search;
    if (destination.pathname === window.location.pathname || swup.cache.has(key) || activePrefetches.has(key)) {
      return Promise.resolve(swup.cache.get(key));
    }
    activePrefetches.add(key);
    return swup.fetchPage(key).catch(function () {}).finally(function () {
      activePrefetches.delete(key);
    });
  }

  function queuePrefetch(link) {
    if (!link || swup.shouldIgnoreVisit(link.href, { el: link })) return;
    var destination = new URL(link.href, window.location.href);
    var key = destination.pathname + destination.search;
    if (destination.pathname === window.location.pathname || swup.cache.has(key) || queuedPrefetchKeys.has(key)) return;
    queuedPrefetchKeys.add(key);
    queuedPrefetches.push(link);
  }

  function discoverArticleLinks(page) {
    if (!page || !page.html) return;
    var parsed = new DOMParser().parseFromString(page.html, 'text/html');
    parsed.querySelectorAll('.post-row a[href]').forEach(queuePrefetch);
  }

  function runPrefetchQueue() {
    if (prefetchQueueRunning || !queuedPrefetches.length) return;
    if (document.hidden || swup.navigating) {
      visiblePrefetchTimer = window.setTimeout(runPrefetchQueue, 800);
      return;
    }
    prefetchQueueRunning = true;
    var link = queuedPrefetches.shift();
    var destination = new URL(link.href, window.location.href);
    var key = destination.pathname + destination.search;
    queuedPrefetchKeys.delete(key);
    prefetch(link).then(function (page) {
      if (destination.pathname === '/blog/' || destination.pathname === '/blog') discoverArticleLinks(page);
    }).finally(function () {
      prefetchQueueRunning = false;
      visiblePrefetchTimer = window.setTimeout(runPrefetchQueue, 180);
    });
  }

  document.addEventListener('pointerover', function (event) {
    prefetch(event.target.closest('a[href]'));
  });
  document.addEventListener('touchstart', function (event) {
    prefetch(event.target.closest('a[href]'));
  }, { passive: true });

  function prefetchVisibleLinks() {
    document.querySelectorAll('.nav-link, .mobile-nav-links a, .post-row a').forEach(queuePrefetch);
    runPrefetchQueue();
  }

  function cancelVisiblePrefetch() {
    window.clearTimeout(visiblePrefetchTimer);
    if (visiblePrefetchIdle && 'cancelIdleCallback' in window) window.cancelIdleCallback(visiblePrefetchIdle);
    if (visiblePrefetchLoadHandler) window.removeEventListener('load', visiblePrefetchLoadHandler);
    visiblePrefetchTimer = null;
    visiblePrefetchIdle = null;
    visiblePrefetchLoadHandler = null;
    queuedPrefetches = [];
    queuedPrefetchKeys.clear();
  }

  function scheduleVisiblePrefetch() {
    cancelVisiblePrefetch();
    function afterLoad() {
      visiblePrefetchLoadHandler = null;
      visiblePrefetchTimer = window.setTimeout(function () {
        if ('requestIdleCallback' in window) {
          visiblePrefetchIdle = window.requestIdleCallback(prefetchVisibleLinks, { timeout: 4000 });
        } else {
          prefetchVisibleLinks();
        }
      }, 1200);
    }
    if (document.readyState === 'complete') afterLoad();
    else {
      visiblePrefetchLoadHandler = afterLoad;
      window.addEventListener('load', visiblePrefetchLoadHandler, { once: true });
    }
  }

  scheduleVisiblePrefetch();
  document.addEventListener('site:page-view', scheduleVisiblePrefetch);

  window.siteSwup = swup;
}());
