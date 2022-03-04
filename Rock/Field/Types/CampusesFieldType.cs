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
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.UI;
using System.Web.UI.WebControls;

using Rock.Attribute;
using Rock.Data;
using Rock.Web.Cache;
using Rock.Web.UI.Controls;

namespace Rock.Field.Types
{
    /// <summary>
    /// Field Type to select multiple (or none) Campuses.
    /// Stored as Campus's Guid.
    /// </summary>
    [RockPlatformSupport( Utility.RockPlatform.WebForms, Utility.RockPlatform.Obsidian )]
    public class CampusesFieldType : SelectFromListFieldType, ICachedEntitiesFieldType
    {
        #region Configuration

        private const string INCLUDE_INACTIVE_KEY = "includeInactive";
        private const string FILTER_CAMPUS_TYPES_KEY = "filterCampusTypes";
        private const string FILTER_CAMPUS_STATUS_KEY = "filterCampusStatus";
        private const string SELECTABLE_CAMPUSES_KEY = "SelectableCampusIds";
        private const string SELECTABLE_CAMPUSES_PUBLIC_KEY = "selectableCampuses";

        private const string CAMPUSES_PROPERTY_KEY = "campuses";
        private const string CAMPUS_TYPES_PROPERTY_KEY = "campusTypes";
        private const string CAMPUS_STATUSES_PROPERTY_KEY = "campusStatuses";

        /// <summary>
        /// Returns a list of the configuration keys
        /// </summary>
        /// <returns></returns>
        public override List<string> ConfigurationKeys()
        {
            var configKeys = base.ConfigurationKeys();
            configKeys.Add( INCLUDE_INACTIVE_KEY );
            configKeys.Add( FILTER_CAMPUS_TYPES_KEY );
            configKeys.Add( FILTER_CAMPUS_STATUS_KEY );
            configKeys.Add( SELECTABLE_CAMPUSES_KEY );
            return configKeys;
        }

        /// <inheritdoc/>
        public override Dictionary<string, string> GetPublicEditConfigurationProperties( Dictionary<string, string> privateConfigurationValues )
        {
            using ( var rockContext = new RockContext() )
            {
                var configurationProperties = new Dictionary<string, string>();

                // Disable security since we are intentionally returning items even
                // if the person (whom we don't know) doesn't have access.
                var definedValueClientService = new Rock.ClientService.Core.DefinedValue.DefinedValueClientService( rockContext, null )
                {
                    EnableSecurity = false
                };

                // Get the campus types and campus status values that are available
                // for the person to choose in the pickers.
                var campusTypes = definedValueClientService.GetDefinedValuesAsListItems( SystemGuid.DefinedType.CAMPUS_TYPE.AsGuid() );
                var campusStatuses = definedValueClientService.GetDefinedValuesAsListItems( SystemGuid.DefinedType.CAMPUS_STATUS.AsGuid() );

                // Get the campuses that are available to be selected.
                var campuses = CampusCache.All()
                    .OrderBy( c => c.Order )
                    .ThenBy( c => c.Name )
                    .Select( c => new CampusFieldType.CampusItemViewModel
                    {
                        Guid = c.Guid,
                        Name = c.Name,
                        Type = c.CampusTypeValueId.HasValue ? ( Guid? ) DefinedValueCache.Get( c.CampusTypeValueId.Value ).Guid : null,
                        Status = c.CampusStatusValueId.HasValue ? ( Guid? ) DefinedValueCache.Get( c.CampusStatusValueId.Value ).Guid : null,
                        IsActive = c.IsActive ?? false
                    } )
                    .ToList();

                configurationProperties[CAMPUS_TYPES_PROPERTY_KEY] = campusTypes.ToCamelCaseJson( false, true );
                configurationProperties[CAMPUS_STATUSES_PROPERTY_KEY] = campusStatuses.ToCamelCaseJson( false, true );
                configurationProperties[CAMPUSES_PROPERTY_KEY] = campuses.ToCamelCaseJson( false, true );

                return configurationProperties;
            }
        }

        /// <inheritdoc/>
        public override Dictionary<string, string> GetPublicConfigurationOptions( Dictionary<string, string> privateConfigurationValues )
        {
            var configurationOptions = privateConfigurationValues.ToDictionary( i => i.Key, i => i.Value );

            // Convert the selectable values from integer identifiers into
            // unique identifiers that can be stored in the database.
            var selectableValues = privateConfigurationValues.GetValueOrDefault( SELECTABLE_CAMPUSES_KEY, string.Empty );
            configurationOptions[SELECTABLE_CAMPUSES_PUBLIC_KEY] = ConvertDelimitedIdsToGuids( selectableValues, v => CampusCache.Get( v )?.Guid );
            configurationOptions.Remove( SELECTABLE_CAMPUSES_KEY );

            // Convert the campus type options from integer identifiers into
            // unique identifiers that can be stored in the database.
            var campusTypes = privateConfigurationValues.GetValueOrDefault( FILTER_CAMPUS_TYPES_KEY, string.Empty );
            configurationOptions[FILTER_CAMPUS_TYPES_KEY] = ConvertDelimitedIdsToGuids( campusTypes, v => DefinedValueCache.Get( v )?.Guid );

            // Convert the campus status options from integer identifiers into
            // unique identifiers that can be stored in the database.
            var campusStatus = privateConfigurationValues.GetValueOrDefault( FILTER_CAMPUS_STATUS_KEY, string.Empty );
            configurationOptions[FILTER_CAMPUS_STATUS_KEY] = ConvertDelimitedIdsToGuids( campusStatus, v => DefinedValueCache.Get( v )?.Guid );

            return configurationOptions;
        }

        /// <inheritdoc/>
        public override Dictionary<string, string> GetPrivateConfigurationOptions( Dictionary<string, string> publicConfigurationValues )
        {
            var configurationOptions = publicConfigurationValues.ToDictionary( i => i.Key, i => i.Value );

            // Convert the selectable values from unique identifiers into
            // integer identifiers that can be stored in the database.
            var selectableValues = publicConfigurationValues.GetValueOrDefault( SELECTABLE_CAMPUSES_PUBLIC_KEY, string.Empty );
            configurationOptions[SELECTABLE_CAMPUSES_KEY] = ConvertDelimitedGuidsToIds( selectableValues, v => CampusCache.Get( v )?.Id );
            configurationOptions.Remove( SELECTABLE_CAMPUSES_PUBLIC_KEY );

            // Convert the campus type options from unique identifiers into
            // integer identifiers that can be stored in the database.
            var campusTypes = publicConfigurationValues.GetValueOrDefault( FILTER_CAMPUS_TYPES_KEY, string.Empty );
            configurationOptions[FILTER_CAMPUS_TYPES_KEY] = ConvertDelimitedGuidsToIds( campusTypes, v => DefinedValueCache.Get( v )?.Id );

            // Convert the campus status options from unique identifiers into
            // integer identifiers that can be stored in the database.
            var campusStatus = publicConfigurationValues.GetValueOrDefault( FILTER_CAMPUS_STATUS_KEY, string.Empty );
            configurationOptions[FILTER_CAMPUS_STATUS_KEY] = ConvertDelimitedGuidsToIds( campusStatus, v => DefinedValueCache.Get( v )?.Id );

            return configurationOptions;
        }

        /// <summary>
        /// Creates the HTML controls required to configure this type of field
        /// </summary>
        /// <returns></returns>
        public override List<Control> ConfigurationControls()
        {
            // Add checkbox for deciding if the list should include inactive items
            var cbIncludeInactive = new RockCheckBox();
            cbIncludeInactive.AutoPostBack = true;
            cbIncludeInactive.CheckedChanged += OnQualifierUpdated;
            cbIncludeInactive.Label = "Include Inactive";
            cbIncludeInactive.Text = "Yes";
            cbIncludeInactive.Help = "When set, inactive campuses will be included in the list.";

            // Checkbox list to select Filter Campus Types
            var campusTypeDefinedValues = DefinedTypeCache.Get( Rock.SystemGuid.DefinedType.CAMPUS_TYPE.AsGuid() ).DefinedValues.Select( v => new { Text = v.Value, Value = v.Id } );
            var cblCampusTypes = new RockCheckBoxList();
            cblCampusTypes.AutoPostBack = true;
            cblCampusTypes.SelectedIndexChanged += OnQualifierUpdated;
            cblCampusTypes.RepeatDirection = RepeatDirection.Horizontal;
            cblCampusTypes.Label = "Filter Campus Types";
            cblCampusTypes.Help = "When set this will filter the campuses displayed in the list to the selected Types. Setting a filter will cause the campus picker to display even if 0 campuses are in the list.";
            cblCampusTypes.DataTextField = "Text";
            cblCampusTypes.DataValueField = "Value";
            cblCampusTypes.DataSource = campusTypeDefinedValues;
            cblCampusTypes.DataBind();

            // Checkbox list to select Filter Campus Status
            var campusStatusDefinedValues = DefinedTypeCache.Get( Rock.SystemGuid.DefinedType.CAMPUS_STATUS.AsGuid() ).DefinedValues.Select( v => new { Text = v.Value, Value = v.Id } );
            var cblCampusStatuses = new RockCheckBoxList();
            cblCampusStatuses.AutoPostBack = true;
            cblCampusStatuses.SelectedIndexChanged += OnQualifierUpdated;
            cblCampusStatuses.RepeatDirection = RepeatDirection.Horizontal;
            cblCampusStatuses.Label = "Filter Campus Status";
            cblCampusStatuses.Help = "When set this will filter the campuses displayed in the list to the selected Statuses. Setting a filter will cause the campus picker to display even if 0 campuses are in the list.";
            cblCampusStatuses.DataTextField = "Text";
            cblCampusStatuses.DataValueField = "Value";
            cblCampusStatuses.DataSource = campusStatusDefinedValues;
            cblCampusStatuses.DataBind();

            var activeCampuses = CampusCache.All( false ).Select( v => new { Text = v.Name, Value = v.Id } );
            var cblSelectableCampuses = new RockCheckBoxList
            {
                AutoPostBack = true,
                RepeatDirection = RepeatDirection.Horizontal,
                Label = "Selectable Campuses",
                DataTextField = "Text",
                DataValueField = "Value",
                DataSource = activeCampuses
            };

            cblCampusStatuses.SelectedIndexChanged += OnQualifierUpdated;
            cblSelectableCampuses.DataBind();

            var controls = base.ConfigurationControls();
            controls.Add( cbIncludeInactive );
            controls.Add( cblCampusTypes );
            controls.Add( cblCampusStatuses );
            controls.Add( cblSelectableCampuses );

            return controls;
        }

        /// <summary>
        /// Gets the configuration value.
        /// </summary>
        /// <param name="controls">The controls.</param>
        /// <returns></returns>
        public override Dictionary<string, ConfigurationValue> ConfigurationValues( List<Control> controls )
        {
            Dictionary<string, ConfigurationValue> configurationValues = base.ConfigurationValues( controls );

            configurationValues.Add( INCLUDE_INACTIVE_KEY, new ConfigurationValue( "Include Inactive", "When set, inactive campuses will be included in the list.", string.Empty ) );
            configurationValues.Add( FILTER_CAMPUS_TYPES_KEY, new ConfigurationValue( "Filter Campus Types", string.Empty, string.Empty ) );
            configurationValues.Add( FILTER_CAMPUS_STATUS_KEY, new ConfigurationValue( "Filter Campus Status", string.Empty, string.Empty ) );
            configurationValues.Add( SELECTABLE_CAMPUSES_KEY, new ConfigurationValue( "Selectable Campuses", "Specify the campuses eligible for this control. If none are specified then all will be displayed.", string.Empty ) );

            if ( controls != null )
            {
                CheckBox cbIncludeInactive = controls.Count > 2 ? controls[2] as CheckBox : null;
                RockCheckBoxList cblCampusTypes = controls.Count > 3 ? controls[3] as RockCheckBoxList : null;
                RockCheckBoxList cblCampusStatuses = controls.Count > 4 ? controls[4] as RockCheckBoxList : null;
                RockCheckBoxList cblSelectableValues = controls.Count > 5 ? controls[5] as RockCheckBoxList : null;

                configurationValues[INCLUDE_INACTIVE_KEY].Value = cbIncludeInactive != null ? cbIncludeInactive.Checked.ToString() : null;
                configurationValues[FILTER_CAMPUS_TYPES_KEY].Value = cblCampusTypes != null ? string.Join( ",", cblCampusTypes.SelectedValues ) : null;
                configurationValues[FILTER_CAMPUS_STATUS_KEY].Value = cblCampusStatuses != null ? string.Join( ",", cblCampusStatuses.SelectedValues ) : null;

                if ( cblSelectableValues != null )
                {
                    var selectableValues = new List<string>( cblSelectableValues.SelectedValues );

                    var activeCampuses = CampusCache.All( cbIncludeInactive.Checked ).Select( v => new { Text = v.Name, Value = v.Id } );
                    cblSelectableValues.DataSource = activeCampuses;
                    cblSelectableValues.DataBind();

                    if ( selectableValues != null && selectableValues.Any() )
                    {
                        foreach ( ListItem listItem in cblSelectableValues.Items )
                        {
                            listItem.Selected = selectableValues.Contains( listItem.Value );
                        }
                    }

                    configurationValues[SELECTABLE_CAMPUSES_KEY].Value = string.Join( ",", cblSelectableValues.SelectedValues );
                }
            }

            return configurationValues;
        }

        /// <summary>
        /// Sets the configuration value.
        /// </summary>
        /// <param name="controls"></param>
        /// <param name="configurationValues"></param>
        public override void SetConfigurationValues( List<Control> controls, Dictionary<string, ConfigurationValue> configurationValues )
        {
            base.SetConfigurationValues( controls, configurationValues );

            if ( controls != null && configurationValues != null )
            {
                CheckBox cbIncludeInactive = controls.Count > 2 ? controls[2] as CheckBox : null;
                RockCheckBoxList cblCampusTypes = controls.Count > 3 ? controls[3] as RockCheckBoxList : null;
                RockCheckBoxList cblCampusStatuses = controls.Count > 4 ? controls[4] as RockCheckBoxList : null;
                RockCheckBoxList cblSelectableValues = controls.Count > 5 ? controls[5] as RockCheckBoxList : null;

                if ( cbIncludeInactive != null )
                {
                    cbIncludeInactive.Checked = configurationValues.GetValueOrNull( INCLUDE_INACTIVE_KEY ).AsBooleanOrNull() ?? false;
                }

                if ( cblCampusTypes != null )
                {
                    var selectedCampusTypes = configurationValues.GetValueOrNull( FILTER_CAMPUS_TYPES_KEY )?.SplitDelimitedValues( false );
                    if ( selectedCampusTypes != null && selectedCampusTypes.Any() )
                    {
                        foreach ( ListItem listItem in cblCampusTypes.Items )
                        {
                            listItem.Selected = selectedCampusTypes.Contains( listItem.Value );
                        }
                    }
                }

                if ( cblCampusStatuses != null )
                {
                    var selectedCampusStatuses = configurationValues.GetValueOrNull( FILTER_CAMPUS_STATUS_KEY )?.SplitDelimitedValues( false );
                    if ( selectedCampusStatuses != null && selectedCampusStatuses.Any() )
                    {
                        foreach ( ListItem listItem in cblCampusStatuses.Items )
                        {
                            listItem.Selected = selectedCampusStatuses.Contains( listItem.Value );
                        }
                    }
                }

                if (cblSelectableValues != null )
                {
                    var selectableValues = configurationValues.GetValueOrNull( SELECTABLE_CAMPUSES_KEY )?.SplitDelimitedValues( false );

                    var activeCampuses = CampusCache.All( cbIncludeInactive.Checked ).Select( v => new { Text = v.Name, Value = v.Id } );
                    cblSelectableValues.DataSource = activeCampuses;
                    cblSelectableValues.DataBind();

                    if ( selectableValues != null && selectableValues.Any() )
                    {
                        foreach ( ListItem listItem in cblSelectableValues.Items )
                        {
                            listItem.Selected = selectableValues.Contains( listItem.Value );
                        }
                    }
                }
            }
        }

        #endregion

        /// <summary>
        /// Creates the control(s) necessary for prompting user for a new value
        /// </summary>
        /// <param name="configurationValues">The configuration values.</param>
        /// <param name="id"></param>
        /// <returns>
        /// The control
        /// </returns>
        public override System.Web.UI.Control EditControl( Dictionary<string, ConfigurationValue> configurationValues, string id )
        {
            return base.EditControl( configurationValues, id );
        }

        /// <summary>
        /// Gets the list source.
        /// </summary>
        /// <value>
        /// The list source.
        /// </value>
        internal override Dictionary<string, string> GetListSource( Dictionary<string, ConfigurationValue> configurationValues )
        {
            var allCampuses = CampusCache.All();

            if ( configurationValues == null )
            {
                return allCampuses.ToDictionary( c => c.Guid.ToString(), c => c.Name );
            }

            bool includeInactive = configurationValues.ContainsKey( INCLUDE_INACTIVE_KEY ) && configurationValues[INCLUDE_INACTIVE_KEY].Value.AsBoolean();
            List<int> campusTypesFilter = configurationValues.ContainsKey( FILTER_CAMPUS_TYPES_KEY ) ? configurationValues[FILTER_CAMPUS_TYPES_KEY].Value.SplitDelimitedValues( false ).AsIntegerList() : null;
            List<int> campusStatusFilter = configurationValues.ContainsKey( FILTER_CAMPUS_STATUS_KEY ) ? configurationValues[FILTER_CAMPUS_STATUS_KEY].Value.SplitDelimitedValues( false ).AsIntegerList() : null;
            List<int> selectableCampuses = configurationValues.ContainsKey( SELECTABLE_CAMPUSES_KEY ) && configurationValues[SELECTABLE_CAMPUSES_KEY].Value.IsNotNullOrWhiteSpace()
                ? configurationValues[SELECTABLE_CAMPUSES_KEY].Value.SplitDelimitedValues( false ).AsIntegerList()
                : null;

            var campusList = allCampuses
                .Where( c => ( !c.IsActive.HasValue || c.IsActive.Value || includeInactive )
                    && campusTypesFilter.ContainsOrEmpty( c.CampusTypeValueId ?? -1 )
                    && campusStatusFilter.ContainsOrEmpty( c.CampusStatusValueId ?? -1 )
                    && selectableCampuses.ContainsOrEmpty( c.Id ) )
                .ToList();

            return campusList.ToDictionary( c => c.Guid.ToString(), c => c.Name );
        }

        /// <summary>
        /// Gets the cached entities as a list.
        /// </summary>
        /// <param name="value">The value.</param>
        /// <returns></returns>
        public List<IEntityCache> GetCachedEntities( string value )
        {
            var guids = value.SplitDelimitedValues().AsGuidList();
            var result = new List<IEntityCache>();

            result.AddRange( guids.Select( g => CampusCache.Get( g ) ) );

            return result;
        }
    }
}
