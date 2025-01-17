﻿// <copyright>
// Copyright by the Spark Development Network
//
// Licensed under the Rock Community License (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.rockrms.com/license
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// </copyright>
//

namespace Rock.ViewModel.Blocks.WorkFlow.FormBuilder
{
    /// <summary>
    /// The state of a field being shown on the page and if it should
    /// be required.
    /// </summary>
    public enum FormFieldVisibility
    {
        /// <summary>
        /// Don't show the field.
        /// </summary>
        Hidden = 0,

        /// <summary>
        /// Field is visible, but a value is not required. */
        /// </summary>
        Optional = 1,

        /// <summary>
        /// Field is visible, and a value is required.
        /// </summary>
        Required = 2
    }
}
