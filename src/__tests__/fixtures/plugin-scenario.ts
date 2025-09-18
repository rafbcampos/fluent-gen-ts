/** UI Button Component */
export interface Button {
  /** Unique identifier */
  id: string;
  /** Button text */
  label: Text;
  /** Click action */
  action?: Action;
  /** Button variant */
  variant: "primary" | "secondary" | "danger";
}

/** Text Component */
export interface Text {
  /** Unique identifier */
  id: string;
  /** Text value */
  value: string;
  /** Text styling */
  style?: TextStyle;
}

/** Text Styling */
export interface TextStyle {
  /** Unique identifier */
  id: string;
  /** Font size */
  fontSize: number;
  /** Font weight */
  fontWeight: "normal" | "bold" | "light";
  /** Text color */
  color: string;
}

/** User Action */
export interface Action {
  /** Unique identifier */
  id: string;
  /** Action type */
  type: "navigate" | "submit" | "cancel";
  /** Target URL for navigation */
  target?: string;
  /** Action label */
  label?: Text;
}

/** Form with Multiple Buttons */
export interface Form {
  /** Unique identifier */
  id: string;
  /** Form title */
  title: string;
  /** Form buttons */
  buttons: Button[];
  /** Primary action */
  primaryAction: Action;
}