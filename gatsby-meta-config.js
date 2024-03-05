module.exports = {
  title: `StatisticsFox.com`,
  description: `지혁이의 데엔일기`,
  language: `ko`, // `ko`, `en` => currently support versions for Korean and English
  siteUrl: `https://statisticsfox.github.io/`,
  ogImage: `/og-image.png`, // Path to your in the 'static' folder
  comments: {
    utterances: {
      repo: ``, // `zoomkoding/zoomkoding-gatsby-blog`,
    },
  },
  ga: '0', // Google Analytics Tracking ID
  author: {
    name: `최지혁`,
    bio: {
      role: `엔지니어`,
      description: ['깨달음의 재미를 아는', '공유에 가치를 두는', '개방과 수용을 중시하는'],
      thumbnail: 'Fox.png', // Path to the image in the 'asset' folder
    },
    social: {
      github: ``, // `https://github.com/StatisticsFox`,
      linkedIn: ``, // `https://www.linkedin.com/in/jeehyuk-choi/`,
      email: ``, // `akfktl328@gmail.com`,
    },
  },

  // metadata for About Page
  about: {
    timestamps: [
      // =====       [Timestamp Sample and Structure]      =====
      // ===== 🚫 Don't erase this sample (여기 지우지 마세요!) =====
      {
        date: '',
        activity: '',
        links: {
          github: '',
          post: '',
          googlePlay: '',
          appStore: '',
          demo: '',
        },
      },
      // ========================================================
      // ========================================================
      {
        date: '2024.01 ~ now',
        activity: 'B.O.A.Z 🐘 (Data engineering study club)',
        links: {
          github: 'https://github.com/BOAZ-bigdata',
          demo: 'https://cafe.naver.com/boazbigdata',
        },
        date: '2023.11 ~ now',
        activity: '글또 9기 (A writing group of developers)',
        links: {
        },
        date: '2023.06 ~ 2024.02',
        activity: 'Fast campus corporate education DX team \n   In charge of data analysis training for Samsung Electronics employees',
        links: {
        },
        date: '2022.03 ~ 2023.07',
        activity: 'D.N.A (Data And Analysis study club)',
        links: {
          github: 'https://github.com/Data-N-Analysis',
          demo: 'https://cafe.naver.com/kyonggidna',
        },
      },
    ],

    projects: [
      // =====        [Project Sample and Structure]        =====
      // ===== 🚫 Don't erase this sample (여기 지우지 마세요!)  =====
      {
        title: '',
        description: '',
        techStack: ['', ''],
        thumbnailUrl: '',
        links: {
          post: '',
          github: '',
          googlePlay: '',
          appStore: '',
          demo: '',
        },
      },
      // ========================================================
      // ========================================================
      {
        title: '2023 경남 공공데이터 활용 아이디어 경진대회',
        description:
          '경상남도 의료소외지역 발굴을 위해 전통적 회귀분석기법과 머신러닝 기술을 혼합하여 의료소외지수를 생성했습니다. 생성한 지수를 기준으로 의료소외지역을 선정하여 대시보드를 제작했습니다. ',
        techStack: ['python', 'R', 'Tableau'],
        thumbnailUrl: 'gyeongnam.png',
        links: {
          github: 'https://github.com/StatisticsFox/2023_Gyeongnam_Public_Data_Utilization_Idea_Competition',
          demo: 'https://public.tableau.com/app/profile/.26001199/viz/_16889018879440/1_2',
          
        },
      },
    ],
  },
};
