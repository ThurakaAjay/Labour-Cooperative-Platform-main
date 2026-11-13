import React from 'react';
import { Route } from 'react-router-dom';
import StyleGuidePage from '../pages/StyleGuidePage';

export const publicRoutes = [
  <Route key="root" path="/" element={<StyleGuidePage />} />,
  <Route key="styleguide" path="/styleguide" element={<StyleGuidePage />} />
];

export default publicRoutes;
