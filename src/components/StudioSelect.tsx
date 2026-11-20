import React from "react";
import { Select, SelectOption, SelectProps } from "../admin/ui/Select";

export type StudioSelectOption = SelectOption;
export type StudioSelectProps = SelectProps;

export const StudioSelect: React.FC<StudioSelectProps> = (props) => {
  return <Select {...props} />;
};

export default StudioSelect;
