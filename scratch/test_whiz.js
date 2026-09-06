async function test() {
  const urls = [
    'https://www.whiz.study',
    'https://www.whiz.study/sat',
    'https://www.whiz.study/dashboard',
    'https://www.whiz.study/exams',
    'https://www.whiz.study/practice',
    'https://www.whiz.study/app',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });
      console.log(`${url} -> Final URL: ${res.url}, Status: ${res.status}`);
    } catch (e) {
      console.error(`${url} -> Error: ${e.message}`);
    }
  }
}

test();
