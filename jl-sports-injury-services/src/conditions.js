/**
 * Condition pages.
 *
 * Each one targets a phrase people genuinely search for locally ("knee pain
 * Newcastle", "sciatica Gosforth") and has to earn the page — real detail on
 * how it presents, how it is assessed and how it is treated. Thin pages spun
 * out of a keyword list get ignored by readers and penalised by Google.
 *
 * Written cautiously on purpose. Nothing here diagnoses anyone: every page
 * routes to an assessment, and every page carries the signs that mean seeing a
 * GP or A&E rather than booking a massage.
 */

const conditions = [
  // -------------------------------------------------------------------------
  {
    slug: 'knee-pain',
    name: 'Knee pain',
    nav: 'Knee pain',
    icon: 'pulse',
    blurb:
      "Runner's knee, patellar tendinopathy, ligament and cartilage injuries, and knees that ache after loading.",
    metaTitle: 'Knee Pain Treatment Newcastle | Gosforth Sports Clinic',
    metaDescription:
      'Knee pain assessed and treated in Gosforth, Newcastle. Runner\'s knee, patellar tendinopathy, ligament and cartilage injuries. No referral needed, book online.',
    intro:
      'Knee pain is the single most common thing walked into the clinic, and the label matters less than what is actually driving it. The knee sits between the hip and the ankle and takes the consequences of both, which is why treating the knee alone so often fails.',
    presentations: [
      'Pain at the front of the knee going up or down stairs, or after sitting for a while',
      'A sharp catch on the inside or outside of the joint when twisting or changing direction',
      'Aching that builds through a run and settles with rest, then returns at the same distance',
      'Swelling that comes up hours after activity rather than immediately',
      'A feeling that the knee is not to be trusted on uneven ground',
    ],
    causes:
      'Most knee pain seen here is load related rather than the result of one dramatic moment: training volume climbing faster than the tissue adapts, a return to running after time off, or a change in surface, shoes or session type. Where there was a specific incident — a twist, a tackle, a landing — the structures involved are different and the assessment changes accordingly.',
    assessment:
      'Assessment starts above and below the joint. Hip strength and control, ankle range, and how you actually load the leg in a squat, a step down and a single leg stance usually explain more than the knee itself does. From there, specific tests narrow down which structures are irritated — the patellar tendon, the joint line, the ligaments — and whether the problem is irritable enough to need calming down before it can be loaded.',
    treatment:
      'Treatment normally pairs hands-on work to settle the symptoms with loading that rebuilds capacity in the tissue that failed. Soft tissue work through the quadriceps, hamstrings and calf, joint mobilisation where movement is restricted, and progressive strength work on the gym floor — which is the part that makes the result hold.',
    timescale:
      'A recently irritated knee often settles noticeably within two to three weeks. Tendon problems are slower and more predictable: expect to be building for six to twelve weeks, with the improvement coming from consistent loading rather than from treatment alone. You will get a realistic estimate at your assessment rather than an open-ended course of appointments.',
    redFlags: [
      'The knee gave way completely at the time of injury, or swelled up within an hour',
      'You cannot put weight through it, or cannot straighten it fully',
      'The joint is hot, red and you feel unwell with it',
    ],
    related: ['injury-assessment', 'sports-massage', 'follow-up-treatment'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'back-pain',
    name: 'Back pain',
    nav: 'Back pain',
    icon: 'shield',
    blurb:
      'Lower back pain from lifting, sitting or sport — assessed properly so you know whether it is muscular, joint or nerve related.',
    metaTitle: 'Back Pain Treatment Newcastle | Gosforth Sports Clinic',
    metaDescription:
      'Lower back pain assessed and treated in Gosforth, Newcastle. Find out whether it is muscular, joint or nerve related, and what to do about it. Book online.',
    intro:
      'Back pain is common, usually not sinister, and very often badly explained. Most of what comes through the clinic settles well once someone works out which tissue is actually irritated and stops the person guessing.',
    presentations: [
      'A sudden catch on bending or lifting that leaves you locked up for a few days',
      'A deep ache low down and to one side that is worse after sitting',
      'Stiffness first thing that eases once you are moving',
      'Pain that spreads into the buttock or down the leg',
      'A back that has been fine for years and has started grumbling since a change in training or work',
    ],
    causes:
      'Lifting technique and load are the obvious ones, but a lot of back pain has more to do with what has changed recently — a new desk setup, a long drive, a stretch of poor sleep, a jump in training, or simply doing much less than usual for a couple of weeks. The tissue has not become weak overnight; the demand on it has changed faster than it adapted.',
    assessment:
      'The first job is working out whether the pain is coming from muscle, from the joints of the spine, or from an irritated nerve — because the three are treated very differently. That means movement testing in each direction, strength and control work through the hips and trunk, and neurological testing where symptoms travel into the leg.',
    treatment:
      'Soft tissue work and joint mobilisation to get movement back and settle the guarding, then loaded rehabilitation that rebuilds confidence in the positions that currently feel threatening. Where the pain is nerve related the emphasis shifts towards calming the irritation and restoring movement gradually rather than pushing into it.',
    timescale:
      'Simple mechanical back pain usually improves substantially within two to six weeks. The important part is not resting until it feels perfect — staying as active as the pain allows consistently produces better outcomes, and part of the job at your appointment is showing you what that looks like in your case.',
    redFlags: [
      'Numbness around the saddle area, or difficulty controlling your bladder or bowels — this needs urgent medical attention, not an appointment here',
      'Weakness in a leg that is getting worse, rather than pain alone',
      'Back pain alongside unexplained weight loss, fever, or a history of cancer',
      'Significant back pain following a fall or a serious accident',
    ],
    related: ['injury-assessment', 'follow-up-treatment', 'deep-tissue-massage'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'neck-pain',
    name: 'Neck pain',
    nav: 'Neck pain',
    icon: 'wave',
    blurb:
      'Stiffness and referred pain from desk posture, training or sleeping awkwardly — including headaches that start in the neck.',
    metaTitle: 'Neck Pain Treatment Newcastle | Gosforth Sports Clinic',
    metaDescription:
      'Neck pain and neck-related headaches assessed and treated in Gosforth, Newcastle. Desk-related stiffness, training strain and restricted movement. Book online.',
    intro:
      'Neck problems rarely stay in the neck. They refer into the shoulder blade, up into the head and down the arm, which is why people are often surprised when the thing that helps is not where the pain is.',
    presentations: [
      'Waking with the neck locked to one side and unable to turn properly',
      'A constant ache between the shoulder blade and the spine that returns every working week',
      'Headaches that start at the base of the skull and creep over one side of the head',
      'Tightness through the tops of the shoulders that massage relieves for a day or two, then returns',
      'Pins and needles or heaviness travelling into the arm',
    ],
    causes:
      'Sustained postures do most of the damage — not because sitting is dangerous, but because holding any position for hours without variation loads the same tissue continuously. Add a heavy pressing session, a night on an unfamiliar pillow or a stressful few weeks with the shoulders held high, and the neck is the thing that complains.',
    assessment:
      'Movement in every direction is tested and compared side to side, along with the joints of the upper spine and the strength of the deep neck and shoulder blade muscles, which are almost always part of the picture. Where symptoms travel down the arm, neurological testing establishes whether a nerve is involved.',
    treatment:
      'Soft tissue work and joint mobilisation get movement back quickly, and for many people medical acupuncture is particularly effective through the neck and upper shoulders where tissue will not release with hands alone. The lasting change comes from strengthening the neck and shoulder blade, plus practical changes to how the day is broken up.',
    timescale:
      'An acutely locked neck often frees up substantially within a week or two. Long-standing desk-related neck pain takes longer to change for good — think six to eight weeks — because the aim is building tolerance to the position rather than avoiding it forever.',
    redFlags: [
      'Neck pain after a significant impact, fall or road traffic accident',
      'Weakness in the arm or hand that is getting worse, or clumsiness with fine movements',
      'Neck stiffness with fever, a severe headache or feeling generally unwell',
      'Dizziness, visual changes or slurred speech alongside the neck symptoms',
    ],
    related: ['injury-assessment', 'medical-acupuncture', 'deep-tissue-massage'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'sciatica-nerve-pain',
    name: 'Sciatica & nerve pain',
    nav: 'Sciatica & nerve pain',
    icon: 'bolt',
    blurb:
      'Sciatica, nerve irritation and the pins, numbness or burning that travels down an arm or leg.',
    metaTitle: 'Sciatica Treatment Newcastle | Nerve Pain Clinic Gosforth',
    metaDescription:
      'Sciatica and nerve pain assessed and treated in Gosforth, Newcastle. Pain, pins and needles or numbness travelling down the leg or arm. Book online.',
    intro:
      'Nerve pain behaves differently to muscular pain, and it worries people more — reasonably so, because it feels unlike anything else. The good news is that most nerve irritation settles well with time and the right approach, and the assessment can usually tell you early which sort you are dealing with.',
    presentations: [
      'Pain travelling from the lower back or buttock down the back of the leg, sometimes past the knee',
      'Pins and needles, numbness or a burning line rather than a dull ache',
      'Symptoms that are worse sitting, or worse first thing, and change with position',
      'A leg that feels heavy or slightly weak alongside the pain',
      'The same pattern in the arm — from the neck into the shoulder, forearm or hand',
    ],
    causes:
      'Nerve symptoms come from a nerve being compressed or irritated somewhere along its path — most often close to the spine, occasionally further along its route. What triggers it is usually mundane: a lift, a period of heavy sitting, or a gradual build-up that finally tips over.',
    assessment:
      'Neurological testing comes first — reflexes, sensation and strength — to establish whether the nerve is genuinely involved and how irritable it is. Movement testing then locates where the irritation is coming from, and tells us whether it responds better to movement in one particular direction, which shapes everything that follows.',
    treatment:
      'The early aim is to reduce irritation, not to stretch aggressively into it, which often makes nerve pain worse. That means positions and movements that settle symptoms, soft tissue work around the area rather than on the nerve itself, and a graded return to loading as the irritability drops. Progress is tracked by whether symptoms are moving closer to the spine rather than further down the limb.',
    timescale:
      'Most nerve irritation improves over six to twelve weeks, and the pattern is usually gradual rather than sudden. It is a slower recovery than a muscular strain and it is worth knowing that at the outset rather than losing confidence at week three.',
    redFlags: [
      'Numbness around the saddle area, or loss of bladder or bowel control — go to A&E, this is an emergency',
      'Weakness that is clearly getting worse, or a foot that catches when you walk',
      'Symptoms in both legs at once',
      'Nerve symptoms following a significant accident or fall',
    ],
    related: ['injury-assessment', 'follow-up-treatment', 'electrotherapy'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'muscle-strains',
    name: 'Muscle strains & tightness',
    nav: 'Muscle strains',
    icon: 'hands',
    blurb:
      'Strains, tears, chronic tightness and trigger points through the hamstrings, calves, quads, back and shoulders.',
    metaTitle: 'Muscle Strain Treatment Newcastle | Sports Injury Gosforth',
    metaDescription:
      'Muscle strains, tears and chronic tightness treated in Gosforth, Newcastle. Hamstring, calf, quad and shoulder injuries assessed and rehabilitated. Book online.',
    intro:
      'A pulled muscle is the most familiar sports injury there is, and also the most commonly rushed. The difference between a strain that resolves and one that recurs every season is almost entirely in how the last third of the rehabilitation is handled.',
    presentations: [
      'A sudden sharp pain mid-sprint or mid-lift that stopped you immediately',
      'Tightness that has crept in over weeks and no longer releases with stretching',
      'Bruising appearing a day or two after the injury',
      'Pain on contracting the muscle against resistance, not just on stretching it',
      'A hamstring or calf that has now gone three times in the same place',
    ],
    causes:
      'Strains happen when demand briefly exceeds what the tissue can tolerate — a sprint from a standing start, a change of direction, fatigue late in a game, or a jump in training load. Recurrent strains almost always point to strength that was never fully restored after the first one.',
    assessment:
      'The muscle is tested through length, strength and contraction to grade how much tissue is involved and what stage of healing it is at. Just as importantly, the assessment looks at why it happened — strength deficits, side-to-side differences and the loads you have been putting through it.',
    treatment:
      'Early on the work is about protecting the healing tissue and keeping the area moving without pulling it apart. As it settles, soft tissue work and ultrasound therapy support tissue quality, and then loading becomes the main event: progressive strength through full range, then speed and change of direction before returning to sport.',
    timescale:
      'A minor strain often settles in two to three weeks. A more significant one is six weeks or more, and returning at four because the pain has gone is the single most common cause of the same injury reappearing. You will be told what needs to be true before it is safe to go back.',
    redFlags: [
      'You heard or felt a pop and cannot contract the muscle at all',
      'Immediate, significant swelling and extensive bruising',
      'A visible gap or lump in the muscle',
      'Severe calf pain and swelling with warmth or breathlessness — seek urgent medical advice',
    ],
    related: ['injury-assessment', 'sports-massage', 'ultrasound-therapy'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'shoulder-pain',
    name: 'Shoulder pain',
    nav: 'Shoulder pain',
    icon: 'dumbbell',
    blurb:
      'Rotator cuff irritation, impingement, pressing pain and shoulders that have lost range from overhead work or desk posture.',
    metaTitle: 'Shoulder Pain Treatment Newcastle | Gosforth Sports Clinic',
    metaDescription:
      'Shoulder pain assessed and treated in Gosforth, Newcastle. Rotator cuff irritation, impingement and pain pressing or reaching overhead. Book online.',
    intro:
      'The shoulder trades stability for range of movement, which makes it superb at what it does and easy to irritate. Most shoulder pain seen here is not damage so much as tissue being asked for more than it currently has.',
    presentations: [
      'A painful arc reaching out to the side, roughly between shoulder and head height',
      'Pain pressing overhead or on the bench, but nothing at rest',
      'Difficulty sleeping on that side',
      'Struggling to reach behind your back — a seatbelt, a bra strap, a back pocket',
      'Weakness or a dead-arm feeling rather than pain',
    ],
    causes:
      'Usually a change in demand: more pressing volume, a return to overhead sport, a decorating weekend, or months of a desk setup that keeps the shoulder rounded forward. Occasionally a specific fall or wrench.',
    assessment:
      'Range of movement is compared side to side, then the rotator cuff is tested position by position to find what is irritated and what is weak. The shoulder blade matters as much as the joint itself — if it is not moving well the shoulder has less room to work with — so its control is assessed too.',
    treatment:
      'Soft tissue work and joint mobilisation to restore range, medical acupuncture where the cuff or upper back will not release, and then loading. Rotator cuff and shoulder blade strength work is what changes the picture, progressed from positions that do not provoke it towards the ones that currently do.',
    timescale:
      'Irritable shoulders take patience. Expect meaningful change over six to twelve weeks, with the earliest wins being sleep and range rather than full strength. Rushing back to heavy overhead work is the reliable way to restart the cycle.',
    redFlags: [
      'Shoulder pain immediately after a fall, with obvious deformity or an inability to lift the arm at all',
      'Pain with pins and needles down the whole arm, or weakness that is worsening',
      'Shoulder or upper arm pain that comes on with exertion and settles with rest, especially with chest tightness or breathlessness — seek urgent medical advice',
    ],
    related: ['injury-assessment', 'sports-massage', 'medical-acupuncture'],
  },

  // -------------------------------------------------------------------------
  {
    slug: 'wrist-elbow-pain',
    name: 'Wrist & elbow pain',
    nav: 'Wrist & elbow pain',
    icon: 'needle',
    blurb:
      'Tennis and golfer\'s elbow, tendon irritation, repetitive strain and grip pain from lifting, racket sport, climbing or keyboard work.',
    metaTitle: 'Tennis Elbow & Wrist Pain Treatment Newcastle | Gosforth',
    metaDescription:
      'Tennis elbow, golfer\'s elbow, wrist and grip pain assessed and treated in Gosforth, Newcastle. Tendon irritation and repetitive strain. Book online.',
    intro:
      'Elbow and wrist problems are tendon problems far more often than not, and tendons follow rules. They respond poorly to rest and well to the right amount of load, which is the opposite of what most people try first.',
    presentations: [
      'Pain on the outside of the elbow gripping, lifting a kettle or shaking hands',
      'Pain on the inside of the elbow pulling, rowing or gripping heavy',
      'Wrist pain at the base of the thumb, or on the little finger side rotating the forearm',
      'Symptoms that are worst first thing and warm up with use, then flare later',
      'Grip strength that has quietly dropped off',
    ],
    causes:
      'Repetition with insufficient recovery: a block of pull-ups or deadlifts, a new racket or grip size, a climbing trip, a house move, or a keyboard and mouse setup that has not changed while the hours have gone up.',
    assessment:
      'The specific tendon is identified by resisted testing and palpation, and the neck is screened where symptoms are vague or travel, because irritation there can present as elbow and forearm pain. Grip strength is measured so progress can be tracked with a number rather than a feeling.',
    treatment:
      'Hands-on work and electrotherapy help settle an irritable tendon, but the treatment that changes tendons is graded loading — isometric holds early for pain relief, progressing into heavier, slower strength work. Practical changes to grip, equipment or workstation usually come into it too.',
    timescale:
      'Tendons are slow. Six to twelve weeks is normal, and occasionally longer for a stubborn elbow that has been there a year. The improvement is steady rather than dramatic, and it does depend on doing the loading between appointments.',
    redFlags: [
      'Pain after a fall onto an outstretched hand, especially with swelling around the wrist — this needs imaging to rule out a fracture',
      'Numbness in the hand that wakes you at night or does not settle',
      'A hot, swollen joint alongside feeling unwell',
    ],
    related: ['injury-assessment', 'electrotherapy', 'follow-up-treatment'],
  },
];

module.exports = { conditions };
