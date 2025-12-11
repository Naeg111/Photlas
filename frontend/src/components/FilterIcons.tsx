interface IconProps {
  className?: string;
}

// 時期（月）のアイコン
export const MonthIcons: Record<
  string,
  (props: IconProps) => JSX.Element
> = {
  "1月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <path d="M120,480 L160,480 L175,130 L135,130 Z" />
        <path d="M392,480 L352,480 L337,130 L377,130 Z" />

        <rect x="100" y="220" width="312" height="45" />

        <rect x="241" y="130" width="30" height="90" />

        <path
          d="M10,50 
             Q256,90 502,50  L512,130        Q256,170 0,130  L10,50 Z"
        />
      </g>
    </svg>
  ),
  "2月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <path
          d="M190,160 L60,40 L110,180 Z"
          stroke="#000000"
          stroke-width="30"
          stroke-linejoin="round"
        />
        <path
          d="M320,160 L452,40 L400,180 Z"
          stroke="#000000"
          stroke-width="30"
          stroke-linejoin="round"
        />

        <path
          d="M110,180
             Q80,180 60,200
             Q40,220 30,250
             Q20,280 50,330   C40,430 120,505 256,505 C392,505 472,430 462,330 Q492,280 482,250
             Q472,220 452,200
             Q432,180 400,180
             
             Q360,100 320,140
             Q256,80 192,140
             Q152,100 110,180
             Z"
        />
      </g>

      <g fill="#FFFFFF">
        <path d="M90,80 L140,110 L130,120 L80,90 Z" />
        <path d="M422,80 L372,110 L382,120 L432,90 Z" />

        <g transform="translate(0, 55)">
          {" "}
          <ellipse
            cx="160"
            cy="240"
            rx="35"
            ry="40"
            transform="rotate(-10, 160, 240)"
          />
          <ellipse
            cx="352"
            cy="240"
            rx="35"
            ry="40"
            transform="rotate(10, 352, 240)"
          />
        </g>

        <circle cx="256" cy="340" r="10" />

        <path
          d="M150,380 
             Q256,360 362,380
             Q372,390 362,410
             Q256,460 150,410
             Q140,390 150,380 Z"
        />
      </g>

      <g fill="#000000">
        <path d="M180,380 Q185,410 200,385 Z" />{" "}
        <path d="M332,380 Q327,410 312,385 Z" />{" "}
        <path d="M220,435 Q225,410 235,430 Z" />{" "}
        <path d="M292,435 Q287,410 277,430 Z" />{" "}
      </g>
    </svg>
  ),
  "3月": ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 学士帽 */}
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
    </svg>
  ),
  "4月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 68 68"
      width="256"
      height="256"
    >
      <g transform="translate(34, 34)" fill="#000000">
        <g>
          <path d="M0,0 C-8,-10 -16,-22 -6,-30 L0,-26 L6,-30 C16,-22 8,-10 0,0 Z" />

          <path
            d="M0,0 C-8,-10 -16,-22 -6,-30 L0,-26 L6,-30 C16,-22 8,-10 0,0 Z"
            transform="rotate(72)"
          />

          <path
            d="M0,0 C-8,-10 -16,-22 -6,-30 L0,-26 L6,-30 C16,-22 8,-10 0,0 Z"
            transform="rotate(144)"
          />

          <path
            d="M0,0 C-8,-10 -16,-22 -6,-30 L0,-26 L6,-30 C16,-22 8,-10 0,0 Z"
            transform="rotate(216)"
          />

          <path
            d="M0,0 C-8,-10 -16,-22 -6,-30 L0,-26 L6,-30 C16,-22 8,-10 0,0 Z"
            transform="rotate(288)"
          />
        </g>

        <circle cx="0" cy="0" r="5" />
      </g>
    </svg>
  ),
  "5月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <rect
          x="40"
          y="20"
          width="16"
          height="472"
          rx="2"
          ry="2"
        />

        <path
          d="M56,80 
             C150,10 280,150 380,100 
             C420,80 460,50 500,20 
             L470,160 
             L500,320 
             C460,280 420,240 380,270 
             C280,350 150,140 56,240 
             Z"
        />

        <circle cx="110" cy="150" r="15" fill="#FFFFFF" />
      </g>
    </svg>
  ),
  "6月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g transform="matrix(1.1 0 0 1.1 -25.6 -25.6)">
        <path
          d="M256,80 C130,80 40,180 40,320 L472,320 C472,180 382,80 256,80 Z"
          fill="#000000"
        />

        <path
          d="M256,320 L256,416 Q256,464 180,448"
          fill="none"
          stroke="#000000"
          stroke-width="36"
          stroke-linecap="round"
        />
      </g>
    </svg>
  ),
  "7月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <g transform="translate(256, 256)">
          <circle cx="0" cy="0" r="24" />

          <g>
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(0)"
            />
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(60)"
            />
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(120)"
            />
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(180)"
            />
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(240)"
            />
            <circle
              cx="40"
              cy="0"
              r="15"
              transform="rotate(300)"
            />
          </g>

          <g>
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(15)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(45)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(75)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(105)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(135)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(165)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(195)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(225)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(255)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(285)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(315)"
            />
            <circle
              cx="90"
              cy="0"
              r="20"
              transform="rotate(345)"
            />
          </g>

          <g>
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(0)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(30)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(60)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(90)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(120)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(150)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(180)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(210)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(240)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(270)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(300)"
            />
            <circle
              cx="150"
              cy="0"
              r="23"
              transform="rotate(330)"
            />
          </g>

          <g>
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(15)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(45)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(75)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(105)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(135)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(165)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(195)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(225)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(255)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(285)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(315)"
            />
            <circle
              cx="220"
              cy="0"
              r="25"
              transform="rotate(345)"
            />
          </g>
        </g>
      </g>
    </svg>
  ),
  "8月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g transform="matrix(1.25 0 0 1.25 -64 -70)">
        <path
          fill="#000000"
          d="M 56,180 L 456,180 A 200,200 0 0,1 56,180 Z"
        />

        <g fill="#FFFFFF">
          <ellipse cx="256" cy="220" rx="6" ry="9" />
          <ellipse cx="256" cy="280" rx="7" ry="10" />
          <ellipse cx="256" cy="340" rx="6" ry="9" />

          <ellipse
            cx="210"
            cy="240"
            rx="6"
            ry="9"
            transform="rotate(-20, 210, 240)"
          />
          <ellipse
            cx="170"
            cy="210"
            rx="6"
            ry="9"
            transform="rotate(-40, 170, 210)"
          />
          <ellipse
            cx="120"
            cy="190"
            rx="6"
            ry="9"
            transform="rotate(-60, 120, 190)"
          />
          <ellipse
            cx="190"
            cy="300"
            rx="7"
            ry="10"
            transform="rotate(-15, 190, 300)"
          />
          <ellipse
            cx="140"
            cy="270"
            rx="6"
            ry="9"
            transform="rotate(-35, 140, 270)"
          />

          <ellipse
            cx="302"
            cy="240"
            rx="6"
            ry="9"
            transform="rotate(20, 302, 240)"
          />
          <ellipse
            cx="342"
            cy="210"
            rx="6"
            ry="9"
            transform="rotate(40, 342, 210)"
          />
          <ellipse
            cx="392"
            cy="190"
            rx="6"
            ry="9"
            transform="rotate(60, 392, 190)"
          />
          <ellipse
            cx="322"
            cy="300"
            rx="7"
            ry="10"
            transform="rotate(15, 322, 300)"
          />
          <ellipse
            cx="372"
            cy="270"
            rx="6"
            ry="9"
            transform="rotate(35, 372, 270)"
          />
        </g>
      </g>
    </svg>
  ),
  "9月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <path
          d="M190,200 
             Q60,100 20,50 
             Q0,20 120,30 
             Q170,50 220,180 Z"
        />

        <path
          d="M322,200 
             Q452,100 492,50 
             Q512,20 392,30 
             Q342,50 292,180 Z"
        />

        <path
          d="M160,180
             C120,190 60,250 60,330
             Q60,400 120,440
             Q180,480 256,480
             Q332,480 392,440
             Q452,400 452,330
             C452,250 392,190 352,180
             Q256,160 160,180 Z"
        />
      </g>

      <g fill="#FFFFFF">
        <path
          d="M185,180 Q70,100 60,70 Q55,55 90,60 Q130,70 195,160 Z"
          opacity="0.9"
        />
        <path
          d="M327,180 Q442,100 452,70 Q457,55 422,60 Q382,70 317,160 Z"
          opacity="0.9"
        />

        <circle cx="170" cy="300" r="18" />
        <circle cx="342" cy="300" r="18" />
        <path d="M246,330 L266,330 L256,345 Z" />
        <path
          d="M256,345 L256,365"
          stroke="#FFFFFF"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path
          d="M256,365 Q226,390 206,360 M256,365 Q286,390 306,360"
          fill="none"
          stroke="#FFFFFF"
          stroke-width="6"
          stroke-linecap="round"
        />
        <g
          stroke="#FFFFFF"
          stroke-width="4"
          stroke-linecap="round"
        >
          <path d="M130,340 L80,330" />
          <path d="M130,360 L90,370" />
          <path d="M382,340 L432,330" />
          <path d="M382,360 L422,370" />
        </g>
      </g>
    </svg>
  ),
  "10月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <path d="M242,50 C232,30 215,20 197,30 C215,0 260,-10 278,20 C287,40 269,60 260,70 L242,50 Z" />
        <path
          d="M256,75
             Q282,60 309,75 Q327,90 345,80 Q372,65 399,85 Q417,100 435,95 Q460,90 485,140
             C525,200 525,320 485,380
             Q460,430 435,425 Q417,420 399,435 Q372,455 345,445 Q327,435 309,450 Q282,465 256,475
             Q230,465 203,450 Q185,435 167,445 Q140,455 113,435 Q95,420 77,425 Q52,430 27,380
             C-13,320 -13,200 27,140
             Q52,90 77,95 Q95,100 113,85 Q140,65 167,80 Q185,90 203,75 Q230,60 256,75 Z"
        />
      </g>

      <g fill="#FFFFFF">
        <path d="M135,190 L227,190 L181,125 Z" />
        <path d="M377,190 L285,190 L331,125 Z" />
        <path d="M256,195 L225,240 L287,240 Z" />

        <path
          d="M144,255 C160,280 180,285 195,285 L210,320 L225,285 C235,290 277,290 287,285 L302,320 L317,285 C332,285 352,280 368,255 Q256,420 144,255
             
             Z"
          transform="matrix(1.3 0 0 1.5 -76.8 -135)"
        />
      </g>
    </svg>
  ),
  "11月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width="256"
      height="256"
    >
      <g fill="#000000">
        <path
          d="M512,10 
             C560,100 620,250 680,360 
             C780,340 920,280 960,300 C980,310 980,340 960,360 
             C880,460 820,540 780,600 
             C880,630 980,640 1020,680 
             C980,750 820,820 640,840 
             
             C660,880 720,920 740,950 
             C680,960 580,940 512,980 C444,940 344,960 284,950 
             C304,920 364,880 384,840 
             
             C204,820 44,750 4,680 
             C44,640 144,630 244,600 
             C204,540 144,460 64,360 C44,340 44,310 64,300 
             C104,280 244,340 344,360 
             C404,250 464,100 512,10 Z"
        />
      </g>
    </svg>
  ),
  "12月": ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g transform="matrix(1.1 0 0 1.1 -25.6 -25.6)">
        <path
          d="M45,400 C65,250 180,180 240,140 L340,80
             L380,120
             C300,180 355,250 375,400 Q210,430 45,400 Z "
          fill="#000000"
        />

        <path
          d="M45,400 Q70,375 95,400 Q120,375 145,400 Q170,375 195,400
             Q220,375 245,400 Q270,375 295,400 Q320,375 345,400
             Q360,375 375,400 L375,425 Q210,455 45,425 Z"
          fill="#FFFFFF"
          stroke="#000000"
          stroke-width="24"
          stroke-linejoin="round"
        />

        <g transform="translate(360, 100)">
          <path
            d="M0,-30 
               Q15,-35 25,-25 Q35,-15 30,0 Q35,15 25,25
               Q15,35 0,30 Q-15,35 -25,25 Q-35,15 -30,0
               Q-35,-15 -25,-25 Q-15,-35 0,-30 Z"
            fill="#FFFFFF"
            stroke="#000000"
            stroke-width="24"
            stroke-linejoin="round"
          />
        </g>
      </g>
    </svg>
  ),
};

// 時間帯のアイコン
export const TimeIcons: Record<
  string,
  (props: IconProps) => JSX.Element
> = {
  朝: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 初日の出 */}
      <path d="M12 6c-3.87 0-7 3.13-7 7 0 1.6.54 3.08 1.43 4.27l1.45-1.45C7.33 14.94 7 14 7 13c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1-.33 1.94-.88 2.82l1.45 1.45C18.46 16.08 19 14.6 19 13c0-3.87-3.13-7-7-7zM1 18v2h22v-2H1zm3.55-4.46l-1.41-1.41L1 14.24l1.41 1.41 2.14-2.11zm14.9 0l2.14 2.11 1.41-1.41-2.14-2.11-1.41 1.41zM12 1c-.55 0-1 .45-1 1v3h2V2c0-.55-.45-1-1-1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l2.12 2.12c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L5.64 5.64zm12.72 0l-2.12 2.12c-.39.39-.39 1.02 0 1.41s1.02.39 1.41 0l2.12-2.12c.39-.39.39-1.02 0-1.41s-1.02-.39-1.41 0z" />
    </svg>
  ),
  昼: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 太陽（周りに三角形の光） */}
      <circle cx="12" cy="12" r="4" />
      {/* 三角形の光 */}
      <path d="M12 1l-1 3h2l-1-3z" />
      <path d="M12 20l1 3h-2l1-3z" />
      <path d="M20 12l3 1v-2l-3 1z" />
      <path d="M1 12l3-1v2l-3-1z" />
      <path d="M18 6l2-2-1.5-0.5L18 6z" />
      <path d="M6 18l-2 2 1.5 0.5L6 18z" />
      <path d="M18 18l2 2 0.5-1.5L18 18z" />
      <path d="M6 6l-2-2-0.5 1.5L6 6z" />
    </svg>
  ),
  夕方: ({ className = "w-5 h-5" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="256"
      height="256"
    >
      <g transform="translate(256, 256) scale(1.25) translate(-256, -256)">
        <g fill="#000000">
          <path d="M 126,300 A 130,130 0 1,1 386,300 L 126,300 Z" />

          <rect x="40" y="298" width="432" height="28" />

          <rect x="80" y="350" width="352" height="18" />
          <rect x="130" y="390" width="252" height="12" />
          <rect x="180" y="420" width="152" height="8" />
        </g>
      </g>
    </svg>
  ),
  夜: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 三日月 */}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};

// 天候のアイコン
export const WeatherIcons: Record<
  string,
  (props: IconProps) => JSX.Element
> = {
  晴れ: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 太陽（周りに三角形の光） - 「昼」と同じ */}
      <circle cx="12" cy="12" r="4" />
      {/* 三角形の光 */}
      <path d="M12 1l-1 3h2l-1-3z" />
      <path d="M12 20l1 3h-2l1-3z" />
      <path d="M20 12l3 1v-2l-3 1z" />
      <path d="M1 12l3-1v2l-3-1z" />
      <path d="M18 6l2-2-1.5-0.5L18 6z" />
      <path d="M6 18l-2 2 1.5 0.5L6 18z" />
      <path d="M18 18l2 2 0.5-1.5L18 18z" />
      <path d="M6 6l-2-2-0.5 1.5L6 6z" />
    </svg>
  ),
  曇り: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 雲 */}
      <path d="M18 10c0-3-2-5-5-5-2 0-4 1-5 3-2 0-4 2-4 4 0 2 2 4 4 4h10c2 0 4-2 4-4 0-2-2-4-4-4z" />
    </svg>
  ),
  雨: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 雲と雨 */}
      <path d="M18 10c0-3-2-5-5-5-2 0-4 1-5 3-2 0-4 2-4 4 0 2 2 4 4 4h10c2 0 4-2 4-4 0-2-2-4-4-4z" />
      <path
        d="M8 17l-1 3m4-3l-1 3m4-3l-1 3m4-3l-1 3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  ),
  雪: ({ className = "w-5 h-5" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* 雲と雪 */}
      <path d="M18 10c0-3-2-5-5-5-2 0-4 1-5 3-2 0-4 2-4 4 0 2 2 4 4 4h10c2 0 4-2 4-4 0-2-2-4-4-4z" />
      <circle cx="8" cy="18" r="1" />
      <circle cx="12" cy="20" r="1" />
      <circle cx="16" cy="18" r="1" />
    </svg>
  ),
};