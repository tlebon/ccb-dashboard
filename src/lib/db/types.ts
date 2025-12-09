export interface Performer {
	id: number;
	name: string;
	slug: string;
	created_at: string;
}

export interface Team {
	id: number;
	name: string;
	slug: string;
	type: 'house' | 'indie' | 'other';
	coach_id: number | null;
	note: string | null;
	created_at: string;
}

export interface TeamMember {
	team_id: number;
	performer_id: number;
	is_former: boolean;
}

export interface Show {
	id: number;
	title: string;
	date: string;
	time: string | null;
	description: string | null;
	source: 'ical' | 'beeper' | 'manual';
	ical_uid: string | null;
	url: string | null;
	image_url: string | null;
	created_at: string;
}

export interface ShowAppearance {
	id: number;
	show_id: number;
	performer_id: number;
	role: 'performer' | 'host' | 'guest' | 'coach';
	team_id: number | null;
}

// Joined types for queries
export interface PerformerWithStats extends Performer {
	team_count: number;
	show_count: number;
}

export interface TeamWithMembers extends Team {
	members: Performer[];
	coach: Performer | null;
}

export interface ShowWithLineup extends Show {
	appearances: (ShowAppearance & { performer: Performer; team?: Team })[];
}
