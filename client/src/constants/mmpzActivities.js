export const MMPZ_CORE_PILLARS = [
    {
        title: 'SRHR & Mental Health Education',
        subtitle: 'Equipping individuals with knowledge and life skills to make informed decisions about sexual, reproductive, and mental health.',
        color: '#EC4899',
        activities: [
            'SRHR and mental health sessions (schools)',
            'SRHR and mental health sessions (communities & support groups)',
            'Experiential learning activities (challenge course)',
        ],
    },
    {
        title: 'Health, Treatment & Psychosocial Support',
        subtitle: 'Providing holistic health care, counselling, and support services to improve well-being and treatment adherence.',
        color: '#6366F1',
        activities: [
            'Health talks (clinic-based or outreach)',
            'Individual and group counselling',
            'ACC (Active Citizen Club)',
            'Buddy System follow-ups',
            'Defaulter tracing and treatment re-initiation',
            'Home visits for treatment support',
            'Family therapy',
            "Couple's therapy",
            'Parenting skills sessions',
        ],
    },
    {
        title: 'Community Engagement & Dialogue',
        subtitle: 'Strengthening communities through open discussions, awareness campaigns, and collaborative action for positive change.',
        color: '#0EA5E9',
        activities: [
            'Community interactive meetings',
            'Community sensitization campaigns',
            'Community dialogues on stigma, treatment, SRHR',
            'Community action projects (murals, cleanup, pledge boards)',
        ],
    },
    {
        title: 'Stakeholder Training & Capacity Building',
        subtitle: 'Empowering leaders, institutions, and influencers with the skills to champion community health and development.',
        color: '#F59E0B',
        activities: [
            'Gatekeepers training',
            'Presentations for community and religious leaders',
            'Training for institutional & faith-based leaders',
        ],
    },
    {
        title: 'Advocacy & Systems Change',
        subtitle: 'Driving policy and societal shifts to create supportive environments for health, rights, and equality.',
        color: '#8B5CF6',
        activities: [
            'Advocacy engagements (policy-level, grassroots-level, media)',
        ],
    },
];

export const ALL_CORE_ACTIVITIES = MMPZ_CORE_PILLARS.flatMap(p => p.activities);
